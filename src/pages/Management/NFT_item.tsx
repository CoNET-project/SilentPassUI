import { distributorNFTItem } from '../../services/wallets'
import { useState } from 'react'

const NFT_item = (_item: distributorNFTItem) => {


	return (
		<div key={_item.id} className="nft-item">
			<div className="nft-info">
				<p className="nft-id">{_item.id}</p>
			</div>
			<div className="nft-info">
				<p className="nft-id">{_item.code}</p>
			</div>
			
			
			{
				_item.showRedeemProcess ?
				<p className='refreshing'>True</p> :
				<p className='refreshing'>False</p>
			}
			
		</div>
	)
}

export default NFT_item