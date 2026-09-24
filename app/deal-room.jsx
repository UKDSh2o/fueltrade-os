/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Mail, MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Sparkles, Users, X } from 'lucide-react';

const emptyData={catalog:[],connections:[],threads:[],messages:[],members:[],aiConfigured:false,draftAvailable:true,configuration:{}};
const labels={internal:'Internal',email:'Email',email_sandbox:'Email sandbox',whatsapp:'WhatsApp',telegram:'Telegram'};
const connectorSteps={
  sandbox_email:['Start an Email sandbox conversation.','Receive the prepared test email.','Reply, check priority and confirm the notification bell.'],
  chatwoot:['Deploy the free Chatwoot Community Edition.','Add its server URL, API token and account ID to FuelTrade.','Register the FuelTrade webhook for incoming messages.'],
  imap:['Connect the mailbox inside Chatwoot using IMAP and SMTP.','Send and receive a test email in Chatwoot.','Use FuelTrade to link the resulting conversation to its trade.'],
  google:['Create the Gmail OAuth application for the self-hosted Chatwoot server.','Authorize the test Gmail account inside Chatwoot.','Complete an inbound and outbound delivery test.'],
  microsoft:['Create the Microsoft OAuth application for the self-hosted Chatwoot server.','Authorize the test Microsoft 365 account inside Chatwoot.','Complete an inbound and outbound delivery test.'],
  whatsapp:['Connect an official WhatsApp Business inbox inside Chatwoot.','Verify the business webhook and phone number.','Send a template or session test message.'],
  telegram:['Create a Telegram bot with BotFather.','Connect the bot token inside Chatwoot.','Send a private test message to the bot.'],
  novu:['Deploy the free Novu Community Edition.','Add the Novu server URL and API key to FuelTrade.','Test urgent-message notification delivery.'],
  ollama:['Deploy an OpenAI-compatible self-hosted model endpoint.','Add its server URL and model name to FuelTrade.','Review an AI draft before sending it.'],
};

export default function DealRoom({ reference, ensureTrade, onNotificationsChanged }) {
  const [data,setData]=useState(emptyData);
  const [activeId,setActiveId]=useState('');
  const [draft,setDraft]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [tradeReady,setTradeReady]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [showInbound,setShowInbound]=useState(false);
  const [selectedProvider,setSelectedProvider]=useState('sandbox_email');
  const [chatwootConversationId,setChatwootConversationId]=useState('');
  const [inbound,setInbound]=useState({author:'supplier@example.test',message:'Urgent: vessel delay may affect the agreed delivery window. Please confirm the revised ETA.'});
  const [newThread,setNewThread]=useState({subject:'Trade group',threadKind:'group',channel:'internal',participants:[]});

  const load=useCallback(async()=>{
    try{
      const response=await fetch(`/api/communications?reference=${encodeURIComponent(reference)}`);
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Unable to load communications');
      setData(payload);setTradeReady(true);setActiveId(current=>payload.threads.some(item=>item.id===current)?current:(payload.threads[0]?.id||''));setNotice('');return true;
    }catch(error){setData(emptyData);setTradeReady(false);setNotice(error.message);return false}
  },[reference]);
  useEffect(()=>{load()},[load]);
  const active=data.threads.find(item=>item.id===activeId);
  const selectedConnector=data.catalog.find(item=>item.provider===selectedProvider);
  const selectedConfiguration=data.configuration?.[selectedProvider]||(['imap','google','microsoft','whatsapp','telegram'].includes(selectedProvider)?data.configuration?.chatwoot:null);
  const messages=useMemo(()=>data.messages.filter(item=>item.threadId===activeId),[data.messages,activeId]);

  const call=async body=>{
    setBusy(true);setNotice('');
    try{
      const response=await fetch('/api/communications',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reference,...body})});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Communication action failed');
      return payload;
    }catch(error){setNotice(error.message);return null}finally{setBusy(false)}
  };
  const createThread=async event=>{
    event.preventDefault();const result=await call({action:'create_thread',...newThread});
    if(result){setShowCreate(false);setNewThread({subject:'Trade group',threadKind:'group',channel:'internal',participants:[]});await load();setActiveId(result.id)}
  };
  const openCreate=async()=>{
    if(tradeReady){setShowCreate(true);return}
    setBusy(true);setNotice('Saving this trade before opening communications…');
    try{
      const stored=await ensureTrade?.();
      if(!stored){setNotice('The trade could not be saved. Review the trade details and try again.');return}
      if(await load()){setShowCreate(true);setNotice('')}
    }finally{setBusy(false)}
  };
  const send=async event=>{
    event.preventDefault();if(!draft.trim()||!activeId)return;
    const result=await call({action:'send_message',threadId:activeId,message:draft.trim()});
    if(result){setDraft('');await load();if(result.priority!=='normal')await onNotificationsChanged?.()}
  };
  const makeDraft=async()=>{
    const result=await call({action:'draft_reply',threadId:activeId});if(result?.draft){setDraft(result.draft);setNotice(result.mode==='self_hosted_ai'?'Self-hosted AI draft prepared. Review it before sending.':'Safe assisted draft prepared. Review and complete it before sending.')}
  };
  const receiveTestEmail=async event=>{
    event.preventDefault();if(!inbound.message.trim()||!activeId)return;
    const result=await call({action:'receive_test_email',threadId:activeId,author:inbound.author,message:inbound.message.trim()});
    if(result){setShowInbound(false);setInbound(value=>({...value,message:''}));await load();if(result.priority!=='normal')await onNotificationsChanged?.()}
  };
  const linkChatwoot=async event=>{
    event.preventDefault();if(!activeId||!chatwootConversationId.trim())return;
    const result=await call({action:'link_chatwoot_conversation',threadId:activeId,conversationId:chatwootConversationId.trim()});
    if(result){setChatwootConversationId('');await load();setNotice(`Linked to Chatwoot conversation ${result.conversationId}.`)}
  };
  const prepareConnector=async item=>{
    setSelectedProvider(item.provider);
    if(item.configured||item.prepared)return;
    const result=await call({action:'save_connection',provider:item.provider,displayName:item.name});if(result){await load();setNotice(`${item.name} is prepared. Follow the setup checklist below.`)}
  };
  const toggleParticipant=email=>setNewThread(value=>({...value,participants:value.participants.includes(email)?value.participants.filter(item=>item!==email):[...value.participants,email]}));

  return <section className="deal-room-panel communications-hub" id="deal-room">
    <div className="panel-head"><div><span className="communications-eyebrow">DEAL COMMUNICATIONS</span><h2>Unified messaging</h2><p>{reference} · Internal chat, email, WhatsApp and Telegram in one audited workspace</p></div><div className="communications-actions"><button className="secondary" onClick={load} disabled={busy}><RefreshCw size={14}/> Refresh</button><button className="primary" onClick={openCreate} disabled={busy}><Plus size={15}/> {busy?'Preparing…':'New conversation'}</button></div></div>
    {notice&&<p role="status" className="deal-room-notice">{notice}</p>}
    <div className="communications-security"><ShieldCheck size={18}/><div><b>Deal-aware and review-first</b><span>Messages, AI drafts and priority changes are recorded against this trade. AI never sends a reply automatically.</span></div></div>
    <div className="connector-strip">{data.catalog.map(item=><article key={item.provider} className={item.configured?'ready':item.prepared?'prepared':''}><div>{item.provider==='ollama'?<Bot size={17}/>:['sandbox_email','imap','google','microsoft'].includes(item.provider)?<Mail size={17}/>:<MessageCircle size={17}/>}<span><b>{item.name}</b><small>{item.description}</small></span></div><button onClick={()=>prepareConnector(item)} disabled={busy}>{item.configured?'Details':item.prepared?'Continue':'Prepare'}</button></article>)}</div>
    {selectedConnector&&<section className="connector-setup"><div className="connector-setup-head"><div><span>{selectedConnector.configured?'READY':selectedConnector.prepared?'PREPARED':'SETUP REQUIRED'}</span><h3>{selectedConnector.name}</h3><p>{selectedConnector.description}</p></div><button type="button" onClick={()=>setSelectedProvider('')} aria-label="Close connector details"><X size={16}/></button></div><ol>{(connectorSteps[selectedConnector.provider]||[]).map(step=><li key={step}>{step}</li>)}</ol>{selectedConfiguration?.missing?.length>0&&<p className="connector-missing"><b>Administrator configuration still required:</b> {selectedConfiguration.missing.join(', ')}</p>}{selectedConnector.provider==='chatwoot'&&selectedConfiguration?.configured&&!selectedConfiguration?.inboundReady&&<p className="connector-missing"><b>Inbound security is not ready.</b> Add a webhook signing secret or fallback token.</p>}{selectedConnector.provider==='sandbox_email'&&<div className="connector-setup-action"><span>No administrator permission or external account is required.</span><button className="primary" type="button" onClick={()=>{setNewThread(value=>({...value,channel:'email_sandbox'}));openCreate()}} disabled={busy}><Mail size={14}/> Start email test</button></div>}</section>}
    {showCreate&&<form className="communications-conversation-builder" onSubmit={createThread}><div className="communications-conversation-builder-head"><div><b>New conversation</b><span>Create a trade group, direct chat or ticket-linked room.</span></div><button type="button" onClick={()=>setShowCreate(false)} aria-label="Close"><X size={16}/></button></div><div className="communications-conversation-builder-fields"><label>Type<select value={newThread.threadKind} onChange={event=>setNewThread(value=>({...value,threadKind:event.target.value}))}><option value="group">Trade group</option><option value="direct">Direct message</option><option value="ticket">Support ticket</option></select></label><label>Channel<select value={newThread.channel} onChange={event=>setNewThread(value=>({...value,channel:event.target.value}))}><option value="internal">Internal</option><option value="email_sandbox">Email sandbox (safe test)</option><option value="email">Email — requires connection</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option></select></label><label className="communications-conversation-subject">Subject<input value={newThread.subject} maxLength={240} onChange={event=>setNewThread(value=>({...value,subject:event.target.value}))}/></label></div>{data.members.length>0&&<div className="communications-participant-picker"><span>Participants</span>{data.members.map(member=><label key={member.email}><input type="checkbox" checked={newThread.participants.includes(member.email)} onChange={()=>toggleParticipant(member.email)}/><i>{(member.name||member.email).slice(0,2).toUpperCase()}</i><span><b>{member.name||member.email}</b><small>{member.role} · {member.status}</small></span></label>)}</div>}<button className="primary" disabled={busy||!newThread.subject.trim()}>{busy?'Creating…':'Create conversation'}</button></form>}
    <div className="communications-layout">
      <div className="communications-conversation-list"><div><b>Conversations</b><span>{data.threads.length}</span></div>{data.threads.length?data.threads.map(item=><button key={item.id} className={item.id===activeId?'active':''} onClick={()=>setActiveId(item.id)}><i className={`communications-channel-icon ${item.channel}`}>{item.threadKind==='direct'?<Users size={14}/>:item.channel==='email'?<Mail size={14}/>:<MessageCircle size={14}/>}</i><span><b>{item.subject}</b><small>{labels[item.channel]} · {item.threadKind}</small></span><em className={item.priority}>{item.priority}</em></button>):<div className="communications-conversation-empty"><MessageCircle size={24}/><b>No conversations yet</b><span>Create the trade group to start the audited message history.</span></div>}</div>
      <div className="communications-conversation-pane">{active?<><header><div><b>{active.subject}</b><span>{labels[active.channel]} · {active.participants.length} participant{active.participants.length===1?'':'s'}</span></div><em className={active.priority}>{active.priority} priority</em></header>{active.channel==='email_sandbox'&&<div className="sandbox-email-bar"><span><Mail size={14}/><b>Safe email test</b> Messages stay inside FuelTrade.</span><button className="secondary" type="button" onClick={()=>setShowInbound(value=>!value)}>{showInbound?'Close test email':'Receive test email'}</button></div>}{!['internal','email_sandbox'].includes(active.channel)&&!active.externalId&&<form className="chatwoot-link-form" onSubmit={linkChatwoot}><div><b>Connect this conversation</b><span>{data.configuration?.chatwoot?.configured?'Enter the conversation ID shown in Chatwoot. FuelTrade verifies it before linking.':'An administrator must add the self-hosted Chatwoot connection first.'}</span></div>{data.configuration?.chatwoot?.configured&&<><input inputMode="numeric" pattern="[0-9]+" maxLength={20} value={chatwootConversationId} onChange={event=>setChatwootConversationId(event.target.value.replace(/\D/g,''))} placeholder="Chatwoot conversation ID" aria-label="Chatwoot conversation ID"/><button className="primary" disabled={busy||!chatwootConversationId}>{busy?'Checking…':'Verify and link'}</button></>}</form>}{!['internal','email_sandbox'].includes(active.channel)&&active.externalId&&<div className="chatwoot-linked"><ShieldCheck size={14}/><span>Connected to Chatwoot conversation <b>{active.externalId}</b>. Incoming and outgoing messages are enabled.</span></div>}{showInbound&&active.channel==='email_sandbox'&&<form className="sandbox-email-form" onSubmit={receiveTestEmail}><label>From<input type="email" value={inbound.author} onChange={event=>setInbound(value=>({...value,author:event.target.value}))}/></label><label>Incoming email<textarea maxLength={8000} value={inbound.message} onChange={event=>setInbound(value=>({...value,message:event.target.value}))}/></label><button className="primary" disabled={busy||!inbound.author||!inbound.message.trim()}><Mail size={14}/>{busy?'Delivering…':'Deliver into sandbox'}</button></form>}<div className="deal-room-messages" aria-live="polite">{messages.length?messages.map(item=><article key={item.id} className={item.direction}><div><strong>{item.author}</strong><span className={`communications-message-priority ${item.aiPriority}`}>{item.aiPriority}</span><time dateTime={new Date(item.sentAt).toISOString()}>{new Date(item.sentAt).toLocaleString()}</time></div><p>{item.body}</p>{item.aiReason&&<small>{item.aiReason}</small>}</article>):<div className="communications-conversation-empty"><MessageCircle size={24}/><b>No messages yet</b><span>Start the conversation below.</span></div>}</div><form onSubmit={send} className="deal-room-compose"><label htmlFor="deal-room-draft">Reply</label><textarea id="deal-room-draft" maxLength={8000} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Write an update, decision or request…"/><div><button type="button" className="secondary" onClick={makeDraft} disabled={busy||!messages.length||!data.draftAvailable}><Sparkles size={14}/> {data.aiConfigured?'Draft with AI':'Create safe draft'}</button><button className="primary" disabled={busy||!draft.trim()}><Send size={14}/>{busy?'Sending…':active.channel==='internal'?'Post message':active.channel==='email_sandbox'?'Send test reply':'Send reply'}</button></div></form></>:<div className="communications-conversation-empty main"><MessageCircle size={32}/><b>Select or create a conversation</b><span>Use trade groups for the deal team, direct rooms for private discussion and ticket rooms for tracked issues.</span></div>}</div>
    </div>
    <p className="communications-footnote">External channels remain disabled until an administrator supplies the self-hosted service URL and credentials. FuelTrade does not store mailbox passwords in the browser.</p>
  </section>;
}
