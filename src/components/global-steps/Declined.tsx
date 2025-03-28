export default function Declined() {
  return (
    <>
      <span style={{ display: 'block' }}></span>

      <div className="step-container">
        <div className="declined-wrapper">
          <img src="/assets/decline.svg" alt="X" />
        </div>
        <div className="declined-description">
          <p>Purchase declined</p>
          <p>Please contact us on Discord or Telegram.</p>
        </div>
      </div>
    </>
  )
}