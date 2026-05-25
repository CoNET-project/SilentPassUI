//	index.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { DaemonProvider } from './providers/DaemonProvider'
import { MerchantCardDatabaseProvider } from './providers/MerchantCardDatabaseProvider'
import { BeamioTagDatabaseProvider } from './providers/BeamioTagDatabaseProvider'
import { HashRouter as Router } from 'react-router-dom'

const root = ReactDOM.createRoot(
  	document.getElementById('root') as HTMLElement
)

root.render(
	<React.StrictMode>
		<Router>
			<DaemonProvider>
				<MerchantCardDatabaseProvider>
					<BeamioTagDatabaseProvider>
						<App />
					</BeamioTagDatabaseProvider>
				</MerchantCardDatabaseProvider>
			</DaemonProvider>
		</Router>
	</React.StrictMode>
)
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()

