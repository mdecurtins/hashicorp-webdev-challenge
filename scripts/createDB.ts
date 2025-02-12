/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

/**
 * NOTE: This script is only to be used by senior candidates
 */

import Database from 'better-sqlite3'
import { executeQuery } from '@datocms/cda-client'
import type { DepartmentNode, PersonRecord } from '../types'

// Libraries such as graphql-codegen give us typed query results in TS,
// in a production environment I would expect to use a tool like that
// instead of hand-rolling a type
type QueryResult = {
	allDepartments: DepartmentNode[]
	allPeople: PersonRecord[]
}

const query = `query {
	allDepartments(first: 100) {
		name
		id
		parent {
			name
			id
		}
	}

	allPeople(first: 100) {
		id
		name
		title
		avatar {
			url
		}
		department {
			name
		}
	}
}`

async function main() {
	// API Docs: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
	const db = new Database('hashicorp.sqlite')
	db.pragma('journal_mode = WAL')

	//Docs here: https://github.com/datocms/cda-client
	const result: QueryResult = await executeQuery(query, {
		// The template repo from HashiCorp implies that the API key should be pasted into a string in the code
		// (createDB.ts line 36), but we already have the token in the .env file, and in a production environment we
		// would not want to commit an API token in plain code. We would do better to source the token from process.env,
		// which I provide in the form of the --env-file option in the npm create-db script in package.json.
		token: process.env.DATO_API_TOKEN,
	})

	try {
		// Ensure foreign keys are available
		db.pragma('foreign_keys = ON')

		const departmentsTableDDL = db.prepare(`
			CREATE TABLE IF NOT EXISTS DEPARTMENTS (
				ID VARCHAR (10) NOT NULL PRIMARY KEY,
				NAME VARCHAR(255) NOT NULL,
				PARENT VARCHAR(10),
				FOREIGN KEY ( PARENT ) REFERENCES DEPARTMENTS ( ID ) DEFERRABLE INITIALLY DEFERRED
			)
		`)

		const peopleTableDDL = db.prepare(`
			CREATE TABLE IF NOT EXISTS PEOPLE (
				ID VARCHAR (10) NOT NULL PRIMARY KEY,
				NAME VARCHAR(255) NOT NULL,
				AVATAR_URL VARCHAR(255) DEFAULT NULL,
				DEPARTMENT_ID VARCHAR(10) NOT NULL,
				FOREIGN KEY ( DEPARTMENT_ID ) REFERENCES DEPARTMENTS ( ID )
			)
		`)

		departmentsTableDDL.run()
		peopleTableDDL.run()

		const insertDepartmentRow = db.prepare(
			`INSERT INTO DEPARTMENTS (ID, NAME, PARENT) VALUES (:id, :name, :parent)`
		)

		const insertDepartments = db.transaction((departments) => {
			for (const department of departments) {
				insertDepartmentRow.run(department)
			}
		})

		/*
		 * Departments may or may not have a parent department. The data returned from the API does list parent departments
		 * before child departments, but we should not rely on this when it comes to inserting data into the DB.
		 *
		 * There may be a more elegant way to do this, but for the sake of this exercise, I make use of a DEFERRED foreign
		 * key on the DEPARTMENTS table so that the constraint will not be checked until the transaction is ready to commit,
		 * thereby allowing department records to be inserted with a parent ID that may or may not have been inserted yet.
		 */
		insertDepartments(
			result.allDepartments.map((department) => {
				return {
					id: department.id,
					name: department.name,
					parent: department.parent?.id || null,
				}
			})
		)

		const insertPersonRow = db.prepare(`
			INSERT INTO PEOPLE (ID, NAME, AVATAR_URL, DEPARTMENT_ID)
			VALUES (:id, :name, :avatar_url, (SELECT ID FROM DEPARTMENTS WHERE NAME = :department_name))
		`)

		const insertPeople = db.transaction((people) => {
			for (const person of people) {
				insertPersonRow.run(person)
			}
		})

		insertPeople(
			result.allPeople?.map((person: PersonRecord) => {
				return {
					id: person.id,
					name: person.name,
					avatar_url: person.avatar?.url || null,
					department_name: person.department?.name,
				}
			})
		)

		console.info('SQLite database created successfully.')
	} catch (e) {
		console.error(e)
	} finally {
		db.close()
	}
}

main()
