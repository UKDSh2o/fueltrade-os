import { permissionAllows } from './access-control.js';
import { canAccessThread } from './communications.js';

const categoryPermission={
  finance:'finance',payment:'finance',banking:'finance',insurance:'insurance',
  logistics:'logistics',voyage:'logistics',custody:'logistics',inventory:'logistics',
  approval:'approvals',documents:'documents',communications:'comments',
  risk:'insurance',
};
export function canSeeNotification(event, access, email, communicationThreads=new Map()) {
  if (access.isOwner) return true;
  const required=categoryPermission[event.category]||'trade';
  if (!permissionAllows(access.permissions,required,'view')) return false;
  if (event.category !== 'communications') return true;
  const id=String(event.eventKey||'').match(/^communication:(.+)$/)?.[1];
  const thread=id&&communicationThreads.get(id);
  return Boolean(thread&&canAccessThread(thread,email,false));
}
