import { useEffect, useRef, useState } from 'react';

interface IntroVideoProps {
  onFinished: () => void;
}

export default function IntroVideo({ onFinished }: IntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  function finishIntro() {
    if (isLeaving) return;
    setIsLeaving(true);
    window.sessionStorage.setItem('guess-game-intro-seen', 'true');
    window.setTimeout(onFinished, 650);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        // بعض المتصفحات تمنع التشغيل التلقائي رغم كتم الصوت.
        // يبقى زر التخطي ظاهرًا ليستطيع المستخدم دخول اللعبة.
      });
    }
  }, []);

  return (
    <div className={`intro-video-layer ${isLeaving ? 'intro-video-layer--leaving' : ''}`}>
      <video
        ref={videoRef}
        className="intro-video"
        src="/media/game-intro.mp4"
        poster="/media/game-background.png"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finishIntro}
        onError={finishIntro}
        aria-label="فيديو افتتاح لعبة خمّن العنصر"
      />

      <button type="button" className="intro-skip-button" onClick={finishIntro}>
        تخطي المقدمة
      </button>
    </div>
  );
}
