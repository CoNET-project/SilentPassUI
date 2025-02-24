import LoadingRing from '../../../components/LoadingRing';

export default function ThirdStep() {
  return (
    <div className="step-container">
      <LoadingRing />
      <p className="blue-text">Please wait, this may take a few seconds.</p>
    </div>
  )
}