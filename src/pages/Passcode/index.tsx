import { useState } from 'react';
import BackButton from '../../components/BackButton';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";

import "./index.css";

interface PasscodeProps {
  new?: boolean;
}

export default function Passcode(props: PasscodeProps) {
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  const [currentPasscodeVisibility, setCurrentPasscodeVisibility] = useState(true);
  const [newPasscodeVisibility, setNewPasscodeVisibility] = useState(true);
  const [confirmPasscodeVisibility, setConfirmPasscodeVisibility] = useState(true);

  function changePasscode() {
    // pending
  }

  function createPasscode() {
    // pending
  }

  function handleSubmit() {
    if (!props.new) {
      changePasscode();
      return;
    }

    createPasscode();
  }

  return (
    <div className="page-container">
      <BackButton to="/settings" />
      <h1>{!props.new ? "Change passcode" : "Create new passcode"}</h1>

      <div className="form-wrapper">
        {
          !props.new && (
            <div className="form-item current-form">
              <p>Current passcode</p>
              <div>
                <input type={currentPasscodeVisibility ? 'text' : 'password'} value={currentPasscode} onChange={(e) => setCurrentPasscode(e.target.value)} placeholder="Type here" />
                <button className={`${currentPasscodeVisibility ? 'visible' : 'not-visible'}`} onClick={() => setCurrentPasscodeVisibility((prev) => !prev)}>
                  {currentPasscodeVisibility ? <VisibilityOnIcon /> : <VisibilityOffIcon />}
                </button>
              </div>
            </div>
          )
        }
        <div className="form-item">
          <p>New passcode</p>
          <div>
            <input type={newPasscodeVisibility ? 'text' : 'password'} value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} placeholder="Type here" />
            <button className={`${newPasscodeVisibility ? 'visible' : 'not-visible'}`} onClick={() => setNewPasscodeVisibility((prev) => !prev)}>
              {newPasscodeVisibility ? <VisibilityOnIcon /> : <VisibilityOffIcon />}
            </button>
          </div>
        </div>
        <div className="form-item">
          <p>Confirm passcode</p>
          <div>
            <input type={confirmPasscodeVisibility ? 'text' : 'password'} value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value)} placeholder="Type here" />
            <button className={`${confirmPasscodeVisibility ? 'visible' : 'not-visible'}`} onClick={() => setConfirmPasscodeVisibility((prev) => !prev)}>
              {confirmPasscodeVisibility ? <VisibilityOnIcon /> : <VisibilityOffIcon />}
            </button>
          </div>
        </div>
      </div>

      <button className="save-button" onClick={handleSubmit}><p>Save Passcode</p></button>
    </div>
  )
}