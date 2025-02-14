/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import {
	departmentRecordsToDepartmentTree,
	findChildrenDepartments,
	findDepartments,
} from '../../utilities'
import {
	PersonRecord,
	DepartmentNode,
	DepartmentRow,
	DepartmentTree,
} from 'types'
import Database from 'better-sqlite3'

type ResponseData = {
	results: PersonRecord[]
}

// Type for SQL bind params
type SqlParams = {
	nameParam?: string
	departmentParam?: string
} & Record<`department_${number}`, string>

/**
 * Handler function for the HashiCorp API route.
 *
 * Recognized URL query parameters:
 * - `searchingName`: `string` -- Find people with names including the substring `nameLike`
 * - `hideNoAvatar`: `boolean` -- Exclude people with no avatar
 * - `department`: `string` -- Find people with the given department id.
 *
 * @param req
 * @param res
 */
export default function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData>
) {
	const { query } = req

	const db = new Database('hashicorp.sqlite')

	let data: PersonRecord[] = []

	try {
		let allDepartments: DepartmentNode[] = []

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

		const departmentTree: DepartmentTree =
			departmentRecordsToDepartmentTree(allDepartments)

		let sqlParams: SqlParams = {}

		const nameParam = (query.searchingName as string) || ''
		const avatarParam = ((query.hideNoAvatar as string) || '') === 'true'
		const departmentParam = (query.department as string) || ''

		let sql = `
			SELECT
				P.ID AS PERSON_ID,
				P.NAME AS PERSON_NAME,
				P.AVATAR_URL,
				D.ID AS DEPARTMENT_ID,
				D.NAME AS DEPARTMENT_NAME
			FROM PEOPLE P
			INNER JOIN DEPARTMENTS D
			ON P.DEPARTMENT_ID = D.ID
			WHERE 1 = 1
		`

		// N.B. In a situation where I couldn't use an ORM and had to build SQL strings dynamically, I would prefer to use
		// a string builder pattern rather than writing out the string concatenation logic like this.
		// I prefer to co-locate bind parameter assignment with SQL concatenation to ensure I don't forget to bind any
		// parameters.
		if (nameParam) {
			sql += `
			AND P.NAME LIKE :nameParam
			`
			sqlParams.nameParam = `%${nameParam.trim().toLowerCase()}%`
		}

		// In this case, TRUE means exclude people with avatars.
		if (avatarParam) {
			sql += `
			AND P.AVATAR_URL IS NULL
			`
		}

		if (departmentParam) {
			const matches = findChildrenDepartments(
				departmentTree,
				findDepartments(departmentTree, departmentParam)?.[0]?.id
			)

			if (matches.length > 1) {
				sql += `
				AND D.ID IN (${matches.map((m, i) => `department_${i}`).join(',')})
				`
				sqlParams = matches.reduce((acc, curr, i) => {
					acc[`department_${i}`] = curr.id
					return acc
				}, sqlParams)
			} else if (matches.length === 1) {
				sql += `
				AND D.ID = :departmentParam
				`
				sqlParams.departmentParam = departmentParam
			} else {
				console.info(`Invalid department parameter found: ${departmentParam}`)
			}
		}

		// Per acceptance criteria, limit search results to 100 records maximum.
		sql += ` LIMIT 100`

		const stmt = db.prepare(sql)
		const rows = stmt.all(sqlParams)

		data = rows.map((row) => {
			return {
				id: row.PERSON_ID,
				name: row.PERSON_NAME,
				avatar: {
					url: row.AVATAR_URL,
				},
				department: {
					id: row.DEPARTMENT_ID,
					name: row.DEPARTMENT_NAME,
				},
			}
		})
	} catch (e) {
		console.error(e)
		res.status(500).end()
		return
	} finally {
		db.close()
	}

	res.status(200).json({ results: data })
}
