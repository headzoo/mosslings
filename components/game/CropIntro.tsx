"use client";

type CropIntroProps = {
  onDismiss: () => void;
};

export function CropIntro({ onDismiss }: CropIntroProps) {
  return (
    <section className="crop-intro" aria-labelledby="crop-intro-title">
      <div className="crop-intro-dim" aria-hidden="true" />
      <div className="crop-intro-copy mossling-intro-copy">
        <h2 id="crop-intro-title">You planted crops!</h2>
        <p>
          Crops need sun and rain to grow. Use your god powers to bring light
          and water when they need it. But watch the skies — too much rain in
          one place can flood the land and wash your fields away.
        </p>
        <button type="button" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </section>
  );
}
