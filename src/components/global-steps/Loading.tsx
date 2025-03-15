import LoadingRing from '../LoadingRing';

export default function Loading() {
  return (
    <div className="step-container">
      <LoadingRing />
      <p className="blue-text">Please wait, this may take a few seconds.</p>
    </div>
  )
}