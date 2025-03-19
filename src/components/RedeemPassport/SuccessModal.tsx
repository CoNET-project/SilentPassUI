import { ReactComponent as ClapHands } from './assets/clap-hands.svg';
import { ReactComponent as Strokes1 } from './assets/strokes-1.svg';
import { ReactComponent as Strokes2 } from './assets/strokes-2.svg';

import "./index.css"; // Use the same CSS file for styling

interface SuccessModalProps {
  onClose: () => void;
}

export default function SuccessModal({ onClose }: SuccessModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <Strokes1 />
          <Strokes2 />
        </div>
        <div className="modal-icon">
          <ClapHands />
        </div>
        <div className="modal-body">
          <h2>Congratulations!</h2>
          <p>
            Now that you own a <strong>Standard Silent Pass Passport</strong>, start browsing freely and safely.
          </p>
          <p className="passport-id">Your Passport ID: <span>#1234567890</span></p>
        </div>
        <div className="modal-footer">
          <button className="modal-button close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
