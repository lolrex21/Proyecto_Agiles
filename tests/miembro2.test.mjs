import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Carga únicamente la fábrica pura; no necesita .env, Supabase ni conexión.
const source = readFileSync(new URL('../src/services/createNotificationService.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createNotificationService } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
function ports() {
  return {
    notificationsRepo: {
      listForUser: async () => [], listForGroups: async () => [],
      countUnreadForUser: async () => 0, countUnreadForGroups: async () => 0,
      markGeneralRead: async () => true, markGroupRead: async () => true,
      subscribeToUserNotifications: () => ({ unsubscribe: async () => {} }),
    },
    trustGroupsRepo: {
      getGroupIdsForUser: async () => [10],
      listPendingInvitationsForUser: async () => [], findManyByIdSimple: async () => [],
    },
    usersRepo: { findByIds: async () => [] },
  }
}
for (const [method, repo, failing] of [
  ['getUserGeneralNotifications', 'notificationsRepo', 'listForUser'],
  ['getUserGroupNotifications', 'notificationsRepo', 'listForGroups'],
  ['getUserGroupNotifications', 'trustGroupsRepo', 'getGroupIdsForUser'],
  ['getPendingInvitesForUser', 'trustGroupsRepo', 'listPendingInvitationsForUser'],
  ['getNotificationSummary', 'notificationsRepo', 'countUnreadForUser'],
  ['getNotificationSummary', 'notificationsRepo', 'countUnreadForGroups'],
  ['getNotificationSummary', 'trustGroupsRepo', 'listPendingInvitationsForUser'],
  ['markGeneralNotificationRead', 'notificationsRepo', 'markGeneralRead'],
  ['markGroupNotificationRead', 'notificationsRepo', 'markGroupRead'],
]) {
  test(`${method} propaga el fallo de ${failing}`, async () => {
    const deps = ports(); const failure = new Error('Conexión interrumpida')
    deps[repo][failing] = async () => { throw failure }
    await assert.rejects(createNotificationService(deps)[method](1), error => error === failure)
  })
}
test('Una consulta exitosa sin datos sí devuelve vacío', async () => {
  const service = createNotificationService(ports())
  assert.deepEqual(await service.getUserGeneralNotifications(1), [])
  assert.deepEqual(await service.getNotificationSummary(1), { pendingInvites: 0, unreadGeneral: 0, unreadGroup: 0 })
})
test('El resumen combina los tres orígenes', async () => {
  const deps = ports()
  deps.notificationsRepo.countUnreadForUser = async () => 2
  deps.notificationsRepo.countUnreadForGroups = async () => 3
  deps.trustGroupsRepo.listPendingInvitationsForUser = async () => [{ id: 1 }]
  assert.deepEqual(await createNotificationService(deps).getNotificationSummary(1), { pendingInvites: 1, unreadGeneral: 2, unreadGroup: 3 })
})
test('Sin grupos no consulta notificaciones de grupo', async () => {
  const deps = ports(); deps.trustGroupsRepo.getGroupIdsForUser = async () => []
  deps.notificationsRepo.listForGroups = async () => { throw new Error('No debe ejecutarse') }
  assert.deepEqual(await createNotificationService(deps).getUserGroupNotifications(1), [])
})
test('Un registro inexistente conserva false, distinto de error', async () => {
  const deps = ports(); deps.notificationsRepo.markGroupRead = async () => false
  assert.equal(await createNotificationService(deps).markGroupNotificationRead(99), false)
})
test('La suscripción delega usuario y libera el recurso', async () => {
  const deps = ports(); let removed = false; const callback = () => {}
  deps.notificationsRepo.subscribeToUserNotifications = (id, cb) => {
    assert.equal(id, 7); assert.equal(cb, callback)
    return { unsubscribe: async () => { removed = true } }
  }
  await createNotificationService(deps).subscribeToNotificationChannels(7, callback).unsubscribe()
  assert.equal(removed, true)
})
