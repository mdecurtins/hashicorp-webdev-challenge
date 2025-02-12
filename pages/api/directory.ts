import type { NextApiRequest, NextApiResponse } from 'next'
import { PersonRecord, DepartmentNode } from 'types'
import Database from 'better-sqlite3'

type ResponseData = {
	allDepartments: DepartmentNode[]
	allPeople: PersonRecord[]
}

// Typically we might want to generate these TS types from our SQL schema, but that's beyond the scope of this
// challenge
type DepartmentRow = {
	ID: string
	NAME: string
	PARENT: string | null
}

type PersonRow = {
	ID: string
	NAME: string
	TITLE: string
	AVATAR_URL: string | null
	DEPARTMENT_ID: string | null
}

/**
 * Handler function for the /directory API route.
 *
 * This function queries data from the SQLite database and shapes it into the shape expected by the GraphQL query. By
 * doing this, we do not need to modify the data handling in the React code.
 *
 * @param req
 * @param res
 */
export default function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData>
) {
	let allDepartments: DepartmentNode[] = []
	let allPeople: PersonRecord[] = []

	const db = new Database('hashicorp.sqlite')

	const deptsStmt = db.prepare('SELECT * FROM DEPARTMENTS')

	const departments = deptsStmt.all()

	if (departments.length > 0) {
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
	}

	const peopleStmt = db.prepare('SELECT * FROM PEOPLE')

	const people = peopleStmt.all()

	if (people.length > 0) {
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
	}

	res.status(200).json({ allDepartments, allPeople })
}
