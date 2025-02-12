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
	id: string
	name: string
	parent: string | null
}

type PersonRow = {
	id: string
	name: string
	title: string
	avatar_url: string | null
	department_id: string | null
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

			if (department.parent != null) {
				parent =
					(departments.find(
						(d) => d.id === department.parent
					) as DepartmentNode) || null
			}

			return {
				id: department.id,
				name: department.name,
				parent: parent,
			}
		})
	}

	const peopleStmt = db.prepare('SELECT * FROM PEOPLE')

	const people = peopleStmt.all()

	if (people.length > 0) {
		allPeople = people.map((person: PersonRow) => {
			let dept: DepartmentNode = null

			if (person.department_id != null) {
				dept = allDepartments.find(
					(d) => d.id === person.department_id
				) as DepartmentNode
			}

			return {
				id: person.id,
				name: person.name,
				title: person.title,
				avatar: {
					url: person.avatar_url,
				},
				department: dept != null ? { name: dept.name } : null,
			}
		})
	}

	res.status(200).json({ allDepartments, allPeople })
}
