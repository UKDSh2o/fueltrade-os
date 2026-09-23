'use client';
import { useCallback, useEffect, useState } from 'react';

export default function DealRoom({ reference }) {
  const [messages,setMessages] = useState([]);
  const [draft,setDraft] = useState('');
  const [notice,setNotice] = useState('');
  const [sending,setSending] = useState(false);
  const load = useCallback(async () => {
    try {
      const response=await fetch(`/api/deal-room?reference=${encodeURIComponent(reference)}`);
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'Unable to load messages');
      setMessages(data.messages);setNotice('');
    } catch(error){setMessages([]);setNotice(error.message)}
  },[reference]);
  useEffect(()=>{load()},[load]);
  const send=async event=>{
    event.preventDefault();if(!draft.trim()||sending)return;
    setSending(true);setNotice('');
    try {
      const response=await fetch('/api/deal-room',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reference,body:draft.trim()})});
      const data=await response.json();if(!response.ok)throw new Error(data.error || 'Unable to send message');
      setDraft('');await load();
    }catch(error){setNotice(error.message)}finally{setSending(false)}
  };
  return <section className="deal-room-panel" id="deal-room">
    <div className="panel-head"><div><h2>Deal room</h2><p>{reference} · Your private trade notes and message history</p></div><button className="secondary" onClick={load}>Refresh</button></div>
    {notice&&<p role="status" className="deal-room-notice">{notice}</p>}
    <div className="deal-room-messages" aria-live="polite">{messages.length?messages.map(item=><article key={item.id}><div><strong>{item.author}</strong><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString()}</time></div><p>{item.body}</p></article>):<p>No messages for this trade yet.</p>}</div>
    <form onSubmit={send} className="deal-room-compose"><label htmlFor="deal-room-draft">New note</label><textarea id="deal-room-draft" maxLength={4000} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Record a decision or update…"/><button className="primary" disabled={sending||!draft.trim()}>{sending?'Saving…':'Post to deal room'}</button></form>
  </section>;
}
