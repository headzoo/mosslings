"use client";

type CropIntroProps = {
  onDismiss: () => void;
};

export function CropIntro({ onDismiss }: CropIntroProps) {
  return (
    <section className="crop-intro" aria-labelledby="crop-intro-title">
      <div className="crop-intro-dim" aria-hidden="true" />
      <div className="crop-intro-copy mossling-intro-copy">
        <h2 id="crop-intro-title">You planted carrots!</h2>
        <p>
          Carrots are a Mossling favorite. Give the little rows rain and sun,
          and they will grow into bright orange snacks for hungry Mosslings. Go
          gently with the rain, though — too much in one place can flood the
          garden.
        </p>
        <button type="button" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </section>
  );
}
