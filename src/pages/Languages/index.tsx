import BackButton from '../../components/BackButton'
import Separator from '../../components/Separator';

import './index.css';

// const languageList = ["中文", "English", "Português (Brasil)"];
const languageList = ["English",];

export default function Languages() {
  return (
    <div className="page-container">
      <BackButton to="/settings" />
      <h1>Language</h1>
      <div className="language-options">
        {languageList.map((language, index) => (
          <>
            <button className="language-button">
              {language}
            </button>
            {index < languageList.length - 1 && <Separator />}
          </>
        ))}
      </div>
    </div>
  )
}