import { useState } from 'react';
import BackButton from '../../components/BackButton';

import './index.css';

import { ReactComponent as LightbulbIcon } from "./assets/lightbulb.svg";

export default function Recover() {
  const [phrases, setPhrase] = useState<string[]>(Array(12).fill(''))

  async function handleRecoverWallet() {
    console.log("RECOVER WALLET METHOD");
  }

  function handleWordChange(index: number, value: string) {
    const newPhrase = [...phrases];
    newPhrase[index] = value;
    setPhrase(newPhrase);
  };

  console.log("PHRASES: ", phrases);

  return (
    <div className="page-container recover-page">
      <div>
        <BackButton to="/" />
        <h1>Recover your account</h1>
      </div>
      <div className="descriptions">
        <p>Write or paste your phrase to recover your <b>account</b></p>
        <p>Make sure you’re using the correct Secret Recovery Phrase before proceeding. You will not be able to undo this.and restore your account.</p>
      </div>

      <div className="word-grid">
        <div className="list">
          {
            phrases.map((phrase, i) => (
              <div className="word-list-item">
                <p>{i + 1}</p>
                <input value={phrases[i]} onChange={(e) => handleWordChange(i, e.target.value)} />
              </div>
            ))
          }
        </div>
        <div className="warning">
          <LightbulbIcon />
          <p>Never lose your Secret Recovery Phrase</p>
        </div>
      </div>

      <button className="recover-button" onClick={handleRecoverWallet}>
        Recover account
      </button>
    </div>
  )
}