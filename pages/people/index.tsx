/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import React, { useState, useEffect, useRef } from 'react'
import { executeQuery } from '@datocms/cda-client'
import { GetStaticPropsResult } from 'next'
import { PersonRecord, DepartmentNode, DepartmentTree, Department } from 'types'
import BaseLayout from '../../layouts/base'
import { useRouter } from 'next/router'
import {
	filterPeople,
	findDepartments,
	departmentRecordsToDepartmentTree,
	findChildrenDepartments,
} from '../../utilities'
import query from './query.graphql'

import Profile from 'components/profile'
import Search from 'components/search'
import DepartmentFilter from 'components/departmentFilter'

interface Props {
	allPeople: PersonRecord[]
	departmentTree: DepartmentTree
}

export async function getStaticProps(): Promise<GetStaticPropsResult<Props>> {
	// Fetch data from SQLite in the same shape as the GraphQL query would have given us
	const res = await fetch('http://localhost:3000/api/directory')
	const results = (await res.json()) as {
		allPeople: PersonRecord[]
		allDepartments: DepartmentNode[]
	}

	const data = {
		allPeople: results.allPeople,
		allDepartments: results.allDepartments,
	}

	return {
		props: {
			allPeople: data.allPeople,
			departmentTree: departmentRecordsToDepartmentTree(data.allDepartments),
		},
	}
}

export default function PeoplePage({
	allPeople,
	departmentTree,
}: Props): React.ReactElement {
	const router = useRouter()
	const { query } = router

	const searchingName = (query.searchingName as string) || ''
	const selectedDepartment = (query.department as string) || ''

	//const [searchingName, setSearchingName] = useState('')
	const [hideNoPicture, setHideNoPicture] = useState(false)
	const [filteredDepartments, setFilteredDepartments] = useState([])
	const [apiResults, setApiResults] = useState([])

	const peopleFiltered = filterPeople(
		apiResults.length > 0 ? apiResults : allPeople,
		searchingName,
		hideNoPicture,
		findChildrenDepartments(
			departmentTree,
			filteredDepartments[filteredDepartments.length - 1]?.id ||
				// Derive the initial value if department is available in a URL query parameter
				findDepartments(departmentTree, selectedDepartment)?.[0]?.id
		)
	)

	const filteredDepartmentIds = filteredDepartments.reduce(
		(acc: string[], department: DepartmentNode) => [...acc, department.id],
		// Derive the initial value of the accumulator if a department is available in a URL query parameter
		selectedDepartment !== '' ? [selectedDepartment] : []
	)

	return (
		<main className="g-grid-container">
			<div>
				<div>
					<h1>HashiCorp Humans</h1>
					<span>Find a HashiCorp human</span>
				</div>
				<Search
					onInputChange={(e: React.ChangeEvent<HTMLInputElement>) => {
						//setSearchingName(e.target.value)
						fetch(`/api/hashicorp?search=${e.target.value}`)
							.then((res) => res.json())
							.then((data: { results: PersonRecord[] }) => {
								setApiResults(data.results)
							})
							.catch((err) => console.error(err))

						router.push(
							{
								pathname: '/people',
								query: {
									...query,
									searchingName: e.target.value,
								},
							},
							null,
							{ shallow: true }
						)
					}}
					onProfileChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setHideNoPicture(e.target.checked)
					}
				/>
			</div>
			<div>
				<aside>
					<DepartmentFilter
						filteredDepartmentIds={filteredDepartmentIds}
						clearFiltersHandler={() => {
							setFilteredDepartments([])

							router.push(
								{
									pathname: '/people',
									query: {
										...query,
									},
								},
								null,
								{ shallow: true }
							)
						}}
						selectFilterHandler={(departmentFilter: Department) => {
							const totalDepartmentFilter = findDepartments(
								departmentTree,
								departmentFilter.id
							)
							setFilteredDepartments(totalDepartmentFilter)

							router.push(
								{
									pathname: '/people',
									query: {
										...query,
										department: departmentFilter.id,
									},
								},
								null,
								{ shallow: true }
							)
						}}
						departmentTree={departmentTree}
					/>
				</aside>
				<ul>
					{peopleFiltered.length === 0 && (
						<div>
							<span>No results found.</span>
						</div>
					)}
					{peopleFiltered.map((person: PersonRecord) => {
						return (
							<li key={person.id}>
								<Profile
									imgUrl={person.avatar?.url}
									name={person.name}
									title={person.title}
									department={person.department.name}
								/>
							</li>
						)
					})}
				</ul>
			</div>
		</main>
	)
}

PeoplePage.layout = BaseLayout
