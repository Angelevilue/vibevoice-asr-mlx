import { AudioTranscription } from './components/audio-transcription';
import { Toaster } from './components/ui/sonner';
import { ThemeProvider } from 'next-themes';
import { ParticlesBackground } from './components/particles-background';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="relative min-h-screen">
        <ParticlesBackground />
        <AudioTranscription />
        <Toaster />
      </div>
    </ThemeProvider>
  );
}