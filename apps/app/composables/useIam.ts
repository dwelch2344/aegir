/** Composable for IAM GraphQL operations: roles, memberships, org relationships. */

interface Role {
  id: number
  key: string
  name: string
  permissions: RolePermission[]
}

interface RolePermission {
  id: number
  roleId: number
  permission: string
  relationshipType: string
}

interface Membership {
  id: number
  identityId: number
  organizationId: number
  identity: { id: number; label: string; email: string }
  organization: { id: number; key: string; name: string }
  roles: Role[]
}

interface OrgRelationship {
  id: number
  ownerOrgId: number
  relatedOrgId: number
  relationshipType: string
  ownerOrg: { id: number; key: string; name: string }
  relatedOrg: { id: number; key: string; name: string }
}

async function gql<T>(query: string, variables?: Record<string, any>): Promise<T> {
  const config = useRuntimeConfig()
  const gatewayUrl = import.meta.server ? (config.gatewayUrl as string) : (config.public.gatewayUrl as string)

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) {
    throw new Error(json.errors[0].message)
  }
  return json.data!
}

export function useIam() {
  // --- Roles ---

  async function searchRoles(input: { idIn?: number[]; keyIn?: string[] } = {}): Promise<Role[]> {
    const data = await gql<{ iam: { roles: { search: { results: Role[] } } } }>(
      `query($input: IamRoleSearchInput!) {
        iam { roles { search(input: $input) { results {
          id key name permissions { id roleId permission relationshipType }
        } } } }
      }`,
      { input },
    )
    return data.iam.roles.search.results
  }

  async function createRole(input: { key: string; name: string }): Promise<Role> {
    const data = await gql<{ iam: { roles: { create: Role } } }>(
      `mutation($input: IamRoleCreateInput!) {
        iam { roles { create(input: $input) {
          id key name permissions { id roleId permission relationshipType }
        } } }
      }`,
      { input },
    )
    return data.iam.roles.create
  }

  async function addRolePermission(input: {
    roleId: number
    permission: string
    relationshipType: string
  }): Promise<RolePermission | null> {
    const data = await gql<{ iam: { roles: { addPermission: RolePermission | null } } }>(
      `mutation($input: IamRolePermissionInput!) {
        iam { roles { addPermission(input: $input) {
          id roleId permission relationshipType
        } } }
      }`,
      { input },
    )
    return data.iam.roles.addPermission
  }

  async function removeRolePermission(input: {
    roleId: number
    permission: string
    relationshipType: string
  }): Promise<boolean> {
    const data = await gql<{ iam: { roles: { removePermission: boolean } } }>(
      `mutation($input: IamRolePermissionInput!) {
        iam { roles { removePermission(input: $input) } }
      }`,
      { input },
    )
    return data.iam.roles.removePermission
  }

  // --- Memberships ---

  async function searchMemberships(input: {
    idIn?: number[]
    identityIdIn?: number[]
    organizationIdIn?: number[]
  }): Promise<Membership[]> {
    const data = await gql<{ iam: { memberships: { search: { results: Membership[] } } } }>(
      `query($input: IamMembershipSearchInput!) {
        iam { memberships { search(input: $input) { results {
          id identityId organizationId
          identity { id label email }
          organization { id key name }
          roles { id key name }
        } } } }
      }`,
      { input },
    )
    return data.iam.memberships.search.results
  }

  async function createMembership(input: {
    identityId: number
    organizationId: number
    roleIds?: number[]
  }): Promise<Membership> {
    const data = await gql<{ iam: { memberships: { create: Membership } } }>(
      `mutation($input: IamMembershipCreateInput!) {
        iam { memberships { create(input: $input) {
          id identityId organizationId
          identity { id label email }
          organization { id key name }
          roles { id key name }
        } } }
      }`,
      { input },
    )
    return data.iam.memberships.create
  }

  async function deleteMembership(membershipId: number): Promise<boolean> {
    const data = await gql<{ iam: { memberships: { delete: boolean } } }>(
      `mutation($membershipId: Int!) {
        iam { memberships { delete(membershipId: $membershipId) } }
      }`,
      { membershipId },
    )
    return data.iam.memberships.delete
  }

  async function assignMembershipRole(input: { membershipId: number; roleId: number }): Promise<boolean> {
    const data = await gql<{ iam: { memberships: { assignRole: boolean } } }>(
      `mutation($input: IamMembershipRoleInput!) {
        iam { memberships { assignRole(input: $input) } }
      }`,
      { input },
    )
    return data.iam.memberships.assignRole
  }

  async function removeMembershipRole(input: { membershipId: number; roleId: number }): Promise<boolean> {
    const data = await gql<{ iam: { memberships: { removeRole: boolean } } }>(
      `mutation($input: IamMembershipRoleInput!) {
        iam { memberships { removeRole(input: $input) } }
      }`,
      { input },
    )
    return data.iam.memberships.removeRole
  }

  // --- Org Relationships ---

  async function searchOrgRelationships(input: {
    ownerOrgIdIn?: number[]
    relatedOrgIdIn?: number[]
    relationshipTypeIn?: string[]
  }): Promise<OrgRelationship[]> {
    const data = await gql<{ iam: { orgRelationships: { search: { results: OrgRelationship[] } } } }>(
      `query($input: IamOrgRelationshipSearchInput!) {
        iam { orgRelationships { search(input: $input) { results {
          id ownerOrgId relatedOrgId relationshipType
          ownerOrg { id key name }
          relatedOrg { id key name }
        } } } }
      }`,
      { input },
    )
    return data.iam.orgRelationships.search.results
  }

  async function createOrgRelationship(input: {
    ownerOrgId: number
    relatedOrgId: number
    relationshipType: string
  }): Promise<OrgRelationship | null> {
    const data = await gql<{ iam: { orgRelationships: { create: OrgRelationship | null } } }>(
      `mutation($input: IamOrgRelationshipCreateInput!) {
        iam { orgRelationships { create(input: $input) {
          id ownerOrgId relatedOrgId relationshipType
          ownerOrg { id key name }
          relatedOrg { id key name }
        } } }
      }`,
      { input },
    )
    return data.iam.orgRelationships.create
  }

  async function deleteOrgRelationship(id: number): Promise<boolean> {
    const data = await gql<{ iam: { orgRelationships: { delete: boolean } } }>(
      `mutation($id: Int!) {
        iam { orgRelationships { delete(id: $id) } }
      }`,
      { id },
    )
    return data.iam.orgRelationships.delete
  }

  // --- Identities (for member selection) ---

  async function searchIdentities(
    input: { idIn?: number[]; labelLike?: string } = {},
  ): Promise<{ id: number; label: string; email: string }[]> {
    const data = await gql<{
      iam: { identities: { search: { results: { id: number; label: string; email: string }[] } } }
    }>(
      `query($input: IamIdentitySearchInput!) {
        iam { identities { search(input: $input) { results { id label email } } } }
      }`,
      { input },
    )
    return data.iam.identities.search.results
  }

  return {
    searchRoles,
    createRole,
    addRolePermission,
    removeRolePermission,
    searchMemberships,
    createMembership,
    deleteMembership,
    assignMembershipRole,
    removeMembershipRole,
    searchOrgRelationships,
    createOrgRelationship,
    deleteOrgRelationship,
    searchIdentities,
  }
}
