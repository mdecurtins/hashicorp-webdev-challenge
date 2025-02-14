/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */
import s from './style.module.css'

export interface SearchProps {
	onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
	onProfileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function Search({
	onInputChange,
	onProfileChange,
}: SearchProps) {
	return (
		<div className={s.searchControls}>
			<div>
				<input
					type="text"
					placeholder="Search people by name"
					onChange={onInputChange}
				/>
			</div>

			<div className={s.hideNoImage}>
				<input type="checkbox" onChange={onProfileChange} />
				<div>Hide people missing a profile image</div>
			</div>
		</div>
	)
}
