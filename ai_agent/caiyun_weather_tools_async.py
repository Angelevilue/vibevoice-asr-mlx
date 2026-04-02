import logging
import os
from datetime import datetime, timedelta
from functools import wraps

import httpx
from langchain_core.tools import tool
from pydantic import Field

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# 创建日志文件处理器
file_handler = logging.FileHandler('weather.log')
file_handler.setLevel(logging.DEBUG)

# 设置日志格式
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s")
file_handler.setFormatter(formatter)

if not logger.handlers:
    logger.addHandler(file_handler)

# 从环境变量获取 API KEY
api_token = os.getenv("CAIYUN_WEATHER_API_KEY")
if not api_token:
    logger.warning("缺少环境变量 CAIYUN_WEATHER_API_KEY，请在 .env 文件中配置")

# 调试模式
debug = os.getenv("DEBUG", "false").lower() == "true"


async def make_request(client: httpx.AsyncClient, url: str, params: dict = None) -> dict:
    """发送 HTTP 请求并处理错误"""
    try:
        response = await client.get(url, params=params, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        
        # 检查彩云 API 返回的状态
        if data.get("status") != "ok":
            error_msg = data.get("error", "未知错误")
            raise Exception(f"彩云 API 错误: {error_msg}")
        
        return data
        
    except httpx.TimeoutException:
        raise Exception("请求超时，请稍后重试")
    except httpx.ConnectError:
        raise Exception("网络连接失败，请检查网络")
    except httpx.HTTPStatusError as e:
        raise Exception(f"HTTP 错误: {e.response.status_code}")


def handle_weather_error(func):
    """天气工具异常处理装饰器"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            if not api_token:
                return "天气服务暂时不可用，缺少 API 配置（CAIYUN_WEATHER_API_KEY）"
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"{func.__name__} 执行失败: {e}")
            return f"获取天气失败：{str(e)}"
    return wrapper


# 天气现象代码转中文映射
SKYCON_MAP = {
    "CLEAR_DAY": "晴", "CLEAR_NIGHT": "晴",
    "PARTLY_CLOUDY_DAY": "多云", "PARTLY_CLOUDY_NIGHT": "多云",
    "CLOUDY": "阴",
    "LIGHT_HAZE": "轻度雾霾", "MODERATE_HAZE": "中度雾霾", "HEAVY_HAZE": "重度雾霾",
    "LIGHT_RAIN": "小雨", "MODERATE_RAIN": "中雨", "HEAVY_RAIN": "大雨", "STORM_RAIN": "暴雨",
    "FOG": "雾",
    "LIGHT_SNOW": "小雪", "MODERATE_SNOW": "中雪", "HEAVY_SNOW": "大雪", "STORM_SNOW": "暴雪",
    "DUST": "浮尘", "SAND": "沙尘", "WIND": "大风",
}


# ========== 城市坐标映射（全局常量） ==========

CITY_COORDINATES = {
    "北京": (116.4074, 39.9042),
    "上海": (121.4737, 31.2304),
    "广州": (113.2644, 23.1291),
    "深圳": (114.0579, 22.5431),
    "杭州": (120.1551, 30.2741),
    "南京": (118.7969, 32.0603),
    "成都": (104.0668, 30.5728),
    "武汉": (114.3054, 30.5931),
    "西安": (108.9398, 34.3416),
    "重庆": (106.5516, 29.5630),
}


def city_to_coordinates(city: str) -> tuple[float, float] | None:
    """
    将城市名转换为经纬度坐标
    
    Args:
        city: 城市名称，如"北京"、"上海市"
        
    Returns:
        (经度, 纬度) 元组，如果城市不支持则返回 None
    """
    city_clean = city.strip().replace("市", "").replace("区", "")
    return CITY_COORDINATES.get(city_clean)


def get_supported_cities() -> str:
    """获取支持的城市列表字符串"""
    return "、".join(CITY_COORDINATES.keys())


# ========== 核心逻辑函数（无装饰器，供内部调用） ==========

async def _fetch_realtime_weather(lng: float, lat: float) -> str:
    """获取实时天气的核心逻辑（内部使用）"""
    async with httpx.AsyncClient() as client:
        result = await make_request(
            client,
            f"https://api.caiyunapp.com/v2.6/{api_token}/{lng},{lat}/realtime",
            {"lang": "zh_CN"},
        )
        result = result["result"]["realtime"]
        
        skycon = result.get("skycon", "")
        weather = SKYCON_MAP.get(skycon, skycon)
        
        weather_info = (
            f"当前天气：{weather}\n"
            f"温度：{result.get('temperature', 'N/A')}°C\n"
            f"体感温度：{result.get('apparent_temperature', 'N/A')}°C\n"
            f"湿度：{result.get('humidity', 0) * 100:.0f}%\n"
            f"风速：{result.get('wind', {}).get('speed', 'N/A')} m/s\n"
            f"空气质量指数：{result.get('air_quality', {}).get('aqi', {}).get('chn', 'N/A')}"
        )
        
        if debug:
            logger.debug(f"Realtime weather for ({lng}, {lat}): {weather_info}")
        
        return weather_info


async def _fetch_hourly_forecast(lng: float, lat: float) -> str:
    """获取小时预报的核心逻辑（内部使用）"""
    async with httpx.AsyncClient() as client:
        result = await make_request(
            client,
            f"https://api.caiyunapp.com/v2.6/{api_token}/{lng},{lat}/hourly",
            {"hourlysteps": "24", "lang": "zh_CN"},
        )
        hourly = result["result"]["hourly"]
        forecast = "未来24小时天气预报：\n"
        
        for i in range(min(24, len(hourly["temperature"]))):
            time_str = hourly["temperature"][i]["datetime"].split("+")[0]
            temp = hourly["temperature"][i]["value"]
            skycon = hourly["skycon"][i]["value"]
            rain_prob = hourly["precipitation"][i]["probability"]
            
            forecast += f"{time_str[11:16]} {temp}°C {SKYCON_MAP.get(skycon, skycon)} 降雨概率{rain_prob}%\n"
            
        return forecast


async def _fetch_daily_forecast(lng: float, lat: float) -> str:
    """获取日报预报的核心逻辑（内部使用）"""
    async with httpx.AsyncClient() as client:
        result = await make_request(
            client,
            f"https://api.caiyunapp.com/v2.6/{api_token}/{lng},{lat}/daily",
            {"dailysteps": "3", "lang": "zh_CN"},
        )
        daily = result["result"]["daily"]
        forecast = "未来3天天气预报：\n"
        
        for i in range(min(3, len(daily["temperature"]))):
            date = daily["temperature"][i]["date"].split("T")[0]
            temp_max = daily["temperature"][i]["max"]
            temp_min = daily["temperature"][i]["min"]
            skycon = daily["skycon"][i]["value"]
            rain_prob = daily["precipitation"][i]["probability"]

            forecast += (
                f"{date} {temp_min}°C~{temp_max}°C {SKYCON_MAP.get(skycon, skycon)} "
                f"降雨概率{rain_prob}%\n"
            )
            
        return forecast


async def _fetch_weather_alerts(lng: float, lat: float) -> str:
    """获取天气预警的核心逻辑（内部使用）"""
    async with httpx.AsyncClient() as client:
        result = await make_request(
            client,
            f"https://api.caiyunapp.com/v2.6/{api_token}/{lng},{lat}/weather",
            {"alert": "true", "lang": "zh_CN"},
        )
        alerts = result["result"].get("alert", {}).get("content", [])
        
        if not alerts:
            return "当前没有天气预警"

        alert_text = "天气预警：\n"
        for alert in alerts:
            alert_text += (
                f"【{alert.get('title', 'N/A')}】{alert.get('status', 'N/A')}\n"
                f"{alert.get('description', '无详细描述')}\n"
            )
            
        return alert_text


# ========== 按城市名查询的工具 ==========

@tool
@handle_weather_error
async def search_realtime_weather(
    city: str = Field(description="城市名称，如：北京、上海、广州"),
) -> str:
    """查询指定城市的实时天气（通过城市名）"""
    coords = city_to_coordinates(city)
    if not coords:
        return f"暂时不支持查询「{city}」的天气，请尝试：{get_supported_cities()}，或使用经纬度查询"
    
    lng, lat = coords
    return await _fetch_realtime_weather(lng=lng, lat=lat)


@tool
@handle_weather_error
async def search_hourly_forecast(
    city: str = Field(description="城市名称，如：北京、上海、广州"),
) -> str:
    """查询指定城市未来24小时天气预报（通过城市名）"""
    coords = city_to_coordinates(city)
    if not coords:
        return f"暂时不支持查询「{city}」的小时预报，请尝试：{get_supported_cities()}，或使用经纬度查询"
    
    lng, lat = coords
    return await _fetch_hourly_forecast(lng=lng, lat=lat)


@tool
@handle_weather_error
async def search_daily_forecast(
    city: str = Field(description="城市名称，如：北京、上海、广州"),
) -> str:
    """查询指定城市未来3天天气预报（通过城市名）"""
    coords = city_to_coordinates(city)
    if not coords:
        return f"暂时不支持查询「{city}」的日报预报，请尝试：{get_supported_cities()}，或使用经纬度查询"
    
    lng, lat = coords
    return await _fetch_daily_forecast(lng=lng, lat=lat)


@tool
@handle_weather_error
async def search_weather_alerts(
    city: str = Field(description="城市名称，如：北京、上海、广州"),
) -> str:
    """查询指定城市的天气预警信息（通过城市名）"""
    coords = city_to_coordinates(city)
    if not coords:
        return f"暂时不支持查询「{city}」的天气预警，请尝试：{get_supported_cities()}，或使用经纬度查询"
    
    lng, lat = coords
    return await _fetch_weather_alerts(lng=lng, lat=lat)


# ========== 按经纬度查询的工具 ==========

@tool
@handle_weather_error
async def get_realtime_weather(
    lng: float = Field(description="经度，如：116.4074"),
    lat: float = Field(description="纬度，如：39.9042"),
) -> str:
    """获取指定经纬度的实时天气"""
    return await _fetch_realtime_weather(lng=lng, lat=lat)


@tool
@handle_weather_error
async def get_hourly_forecast(
    lng: float = Field(description="经度，如：116.4074"),
    lat: float = Field(description="纬度，如：39.9042"),
) -> str:
    """获取指定经纬度未来24小时天气预报（每小时）"""
    return await _fetch_hourly_forecast(lng=lng, lat=lat)


@tool
@handle_weather_error
async def get_daily_forecast(
    lng: float = Field(description="经度，如：116.4074"),
    lat: float = Field(description="纬度，如：39.9042"),
) -> str:
    """获取指定经纬度未来3天天气预报"""
    return await _fetch_daily_forecast(lng=lng, lat=lat)


@tool
@handle_weather_error
async def get_weather_alerts(
    lng: float = Field(description="经度，如：116.4074"),
    lat: float = Field(description="纬度，如：39.9042"),
) -> str:
    """获取指定经纬度的天气预警信息"""
    return await _fetch_weather_alerts(lng=lng, lat=lat)


# 导出所有工具
__all__ = [
    # 按城市名查询（用户友好）
    "search_realtime_weather",  # 实时天气
    "search_hourly_forecast",   # 24小时预报
    "search_daily_forecast",    # 3天预报
    "search_weather_alerts",    # 天气预警
    # 按经纬度查询（精确查询）
    "get_realtime_weather",     # 实时天气
    "get_hourly_forecast",      # 24小时预报
    "get_daily_forecast",       # 3天预报
    "get_weather_alerts",       # 天气预警
]
