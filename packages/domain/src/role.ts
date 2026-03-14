export interface Role {
  id: number
  key: string
  name: string
}

export interface RolePermission {
  id: number
  roleId: number
  permission: string
  relationshipType: string
}
