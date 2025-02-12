/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { PersonRecord } from 'types'
import Database from 'better-sqlite3'

type ResponseData = {
	results: PersonRecord[]
}

export default function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData>
) {
	const { query } = req
	const searchParam = query.search || ''

	const db = new Database('hashicorp.sqlite')

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
	`

	// N.B. In a situation where I couldn't use an ORM and had to build SQL strings dynamically, I would prefer to use
	// a string builder pattern rather than writing out the string concatenation logic like this.
	if (searchParam !== '') {
		sql += ` WHERE P.NAME LIKE :searchParam`
	}

	// Per acceptance criteria, limit search results to 100 records maximum.
	sql += ` LIMIT 100`

	const stmt = db.prepare(sql)

	let data: PersonRecord[] = []

	try {
		const rows = stmt.all({ searchParam: `%${searchParam}%` })

		if (rows.length > 0) {
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
		}
	} catch (e) {
		console.error(e)
	} finally {
		db.close()
	}

	res.status(200).json({ results: data })
}
