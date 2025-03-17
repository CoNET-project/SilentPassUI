import { distributorNFTItem } from '../../services/wallets'
import { useState } from 'react'

const NFT_item = (_item: distributorNFTItem, process: boolean) => {


	const rendeRedeemCodeButton = () => {
		
			return <p className='refreshing'>RedeemCode...</p>
		
	}
	
	return (
		<div key={_item.id} className="nft-item">
			<div className="nft-info">
				<p className="nft-id">{_item.id}</p>
			</div>
			<div className="nft-actions">
				{ process ? rendeRedeemCodeButton(): ''}
			</div>
		</div>
	)
}

export default NFT_item