/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

export type DepartmentTree = DepartmentRecord[]

export interface Department {
	id: string
	name: string
}
export interface DepartmentNode extends Department {
	parent: Department | null
}

export interface DepartmentRecord extends DepartmentNode {
	children?: DepartmentRecord[]
}

export interface PersonRecord {
	id: string
	name?: string
	title?: string
	avatar?: {
		url: string
		alt?: string
	}
	department?: Department
}

export type AllData = {
	allDepartments: DepartmentNode[]
	allPeople: PersonRecord[]
}

// Typically we might want to generate these TS types from our SQL schema, but that's beyond the scope of this
// challenge
export type DepartmentRow = {
	ID: string
	NAME: string
	PARENT: string | null
}

export type PersonRow = {
	ID: string
	NAME: string
	TITLE: string
	AVATAR_URL: string | null
	DEPARTMENT_ID: string | null
}
