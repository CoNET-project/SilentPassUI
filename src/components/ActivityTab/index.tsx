import './index.css';
import { activityMock } from './mock';

import { ReactComponent as SolanaToken } from './assets/solana-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';

export default function ActivityTab() {

  return (
    <div className="activity-tab">
      {
        activityMock.map((activity) => (
          <div className="activity">
            <p className="main-p">{activity.date}</p>
            {
              activity.negotiations.map((negotiation) => (
                <div className="negotiation">
                  <div className="negotiation-item">
                    <span className="span-label">You sent</span>
                    <div className="detail">
                      { negotiation.sent.token === 'SP' ? <SpToken /> : <SolanaToken /> }
                      <p className="main-p">{negotiation.sent.value}</p>
                      <span className="span-label">${negotiation.sent.token}</span>
                    </div>
                  </div>

                  <div className="negotiation-item">
                    <span className="span-label">You got</span>
                    <div className="detail">
                      { negotiation.got.token === 'SP' ? <SpToken /> : <SolanaToken /> }
                      <p className="main-p">{negotiation.got.value}</p>
                      <span className="span-label">${negotiation.got.token}</span>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        ))
      }
    </div>
  )
}