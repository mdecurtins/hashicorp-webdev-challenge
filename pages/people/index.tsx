/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import React, { useState } from 'react'
// import { executeQuery } from '@datocms/cda-client'
import { GetStaticPropsResult } from 'next'
import {
	PersonRecord,
	PersonRow,
	DepartmentNode,
	DepartmentRow,
	DepartmentTree,
	Department,
} from 'types'
import BaseLayout from '../../layouts/base'
import { useRouter, NextRouter } from 'next/router'
import {
	filterPeople,
	findDepartments,
	departmentRecordsToDepartmentTree,
	findChildrenDepartments,
} from '../../utilities'
// import query from './query.graphql'
import Database from 'better-sqlite3'
import s from './style.module.css'

import Profile from 'components/profile'
import Search from 'components/search'
import DepartmentFilter from 'components/departmentFilter'

interface Props {
	allPeople: PersonRecord[]
	departmentTree: DepartmentTree
}

type FetchFilteredDataOptions = {
	searchingName?: string
	hideNoPicture?: boolean
	department?: string
}

export async function getStaticProps(): Promise<GetStaticPropsResult<Props>> {
	// Fetch data from SQLite in the same shape as the GraphQL query would have given us
	// Fetching via direct SQL calls here because API routes are not available in production in getStaticProps
	let allDepartments: DepartmentNode[] = []
	let allPeople: PersonRecord[] = []

	const db = new Database('hashicorp.sqlite')
	try {
		const deptsStmt = db.prepare('SELECT * FROM DEPARTMENTS')

		const departments = deptsStmt.all()
		allDepartments = departments.map((department: DepartmentRow) => {
			let parent: DepartmentNode = null

			if (department.PARENT != null) {
				parent =
					(departments.find(
						(d) => d.id === department.PARENT
					) as DepartmentNode) || null
			}

			return {
				id: department.ID,
				name: department.NAME,
				parent: parent,
			}
		})

		const peopleStmt = db.prepare('SELECT * FROM PEOPLE')

		const people = peopleStmt.all()
		allPeople = people.map((person: PersonRow) => {
			let dept: DepartmentNode = null

			if (person.DEPARTMENT_ID != null) {
				dept = allDepartments.find(
					(d) => d.id === person.DEPARTMENT_ID
				) as DepartmentNode
			}

			return {
				id: person.ID,
				name: person.NAME,
				title: person.TITLE,
				avatar: {
					url: person.AVATAR_URL,
				},
				department: dept != null ? { name: dept.name } : null,
			}
		})
	} catch (e) {
		console.error(e)
		// Try to fail gracefully with empty data
		return {
			props: {
				allPeople: [],
				departmentTree: [],
			},
		}
	} finally {
		db.close()
	}

	return {
		props: {
			allPeople: allPeople,
			departmentTree: departmentRecordsToDepartmentTree(allDepartments),
		},
	}
}

export default function PeoplePage({
	allPeople,
	departmentTree,
}: Props): React.ReactElement {
	const router = useRouter()
	const { query } = router

	const [filteredDepartments, setFilteredDepartments] = useState([])

	// Filter on initial load, accounting for any URL query parameters.
	const searchingName = (query.searchingName as string) || ''
	const selectedDepartment = (query.department as string) || ''
	const hideNoPicture = (query.hideNoPicture as string) === 'true'

	const peopleFiltered = filterPeople(
		allPeople,
		searchingName,
		hideNoPicture,
		findChildrenDepartments(
			departmentTree,
			filteredDepartments[filteredDepartments.length - 1]?.id ||
				// Derive the initial value if department is available in a URL query parameter
				findDepartments(departmentTree, selectedDepartment)?.[0]?.id
		)
	)

	const [filteredPeople, setFilteredPeople] = useState(peopleFiltered)

	/**
	 * Function to fetch filtered people data.
	 *
	 * @param router the current state of the Next router
	 * @param opts contains the changed values to pass as query parameters
	 */
	const fetchFilteredData = async (
		router: NextRouter,
		opts: FetchFilteredDataOptions
	) => {
		// Selectively overwrite current query with changed query opts
		const params: FetchFilteredDataOptions = { ...router.query, ...opts }

		const urlParams = Object.entries(params)
			.filter(
				([key, value]) =>
					(key === 'searchingName' || key === 'department') && value !== ''
			)
			.map(([key, value]) => `${key}=${value}`)
			.join('&')

		const res = await fetch(
			`/api/hashicorp${urlParams.length ? `?${urlParams}` : ''}`
		)
		const data = await res.json()

		setFilteredPeople(data.results)
	}

	const filteredDepartmentIds = filteredDepartments.reduce(
		(acc: string[], department: DepartmentNode) => [...acc, department.id],
		// Derive the initial value of the accumulator if a department is available in a URL query parameter
		selectedDepartment !== '' ? [selectedDepartment] : []
	)

	return (
		<main className="g-grid-container">
			<div className={s.searchContainer}>
				<div>
					<div className={s.masthead}>
						<h1>HashiCorp Humans</h1>
						<span>Find a HashiCorp human</span>
					</div>
					<Search
						onInputChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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

							fetchFilteredData(router, { searchingName: e.target.value })
						}}
						onProfileChange={(e: React.ChangeEvent<HTMLInputElement>) => {
							router.push(
								{
									pathname: '/people',
									query: {
										...query,
										hideNoPicture: e.target.checked,
									},
								},
								null,
								{ shallow: true }
							)

							fetchFilteredData(router, { hideNoPicture: e.target.checked })
						}}
					/>
				</div>
			</div>
			<div className={s.filterGrid}>
				<aside className={s.departmentFilter}>
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

							fetchFilteredData(router, {})
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

							fetchFilteredData(router, { department: departmentFilter.id })
						}}
						departmentTree={departmentTree}
					/>
				</aside>
				<ul className={s.personGrid}>
					{filteredPeople.length === 0 && (
						<div>
							<span>No results found.</span>
						</div>
					)}
					{filteredPeople.map((person: PersonRecord) => {
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
