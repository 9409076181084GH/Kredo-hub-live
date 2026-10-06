import React, { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from './supabase.js'

const BANKS = {
  'ABSA':'632005','FNB':'250655','Standard Bank':'051001','Nedbank':'198765',
  'Capitec Bank':'470010','African Bank':'430000','TymeBank':'678910','Discovery Bank':'679000','Investec':'580105'
}
const PROVINCES = ['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Limpopo','Mpumalanga','North West','Free State','Northern Cape']
const MARITAL = ['Single','Married','Divorced','Widowed']
const MARRIAGE_TYPES = ['In Community of Property (COP)','Out of Community with Accrual','Out of Community without Accrual','Customary Marriage','Muslim Marriage']

function validateSAID(id){
  if(!/^\d{13}$/.test(id)) return {valid:false, error:'Must be 13 digits'}
  let sum=0
  for(let i=0;i<13;i++){
    let d=parseInt(id[i])
    if((13-i)%2===0){ d*=2; if(d>9) d-=9 }
    sum+=d
  }
  if(sum%10!==0) return {valid:false, error:'Luhn check failed'}
  const yy=id.slice(0,2), mm=id.slice(2,4), dd=id.slice(4,6)
  const year = parseInt(yy)>30?1900+parseInt(yy):2000+parseInt(yy)
  const dob = new Date(year, mm-1, dd)
  if(isNaN(dob)) return {valid:false, error:'Invalid date in ID'}
  const gender = parseInt(id.slice(6,10))<5000?'Female':'Male'
  const citizen = id[10]==='0'?'SA Citizen':'Permanent Resident'
  return {valid:true, dob: dob.toISOString().split('T')[0], gender, citizen}
}

export default function App(){
  const [session, setSession] = useState(()=>JSON.parse(localStorage.getItem('kredo-session')||'null'))
  const [page, setPage] = useState('dashboard')
  const [leads, setLeads] = useState(()=>JSON.parse(localStorage.getItem('kredo-leads')||'[]'))
  const [agents, setAgents] = useState(()=>JSON.parse(localStorage.getItem('kredo-agents')||'[{"id":"1","email":"admin@kredohub.co.za","name":"Admin User","role":"Admin","password_hash":"Admin123!","status":"active"}]'))
  const [showCreate, setShowCreate] = useState(false)
  const [loginForm, setLoginForm] = useState({email:'', password:''})
  const [createForm, setCreateForm] = useState({name:'', email:'', phone:'', role:'Agent', password:'', confirm:'', invite:''})
  const [leadForm, setLeadForm] = useState({first_name:'',last_name:'',id_number:'',dob:'',marital_status:'Single',marriage_type:'',province:'',phone:'',email:'',address:'',city:'',postal_code:'',employer_name:'',employment_type:'Permanent',gross_salary:'',net_salary:'',additional_income:'',salary_date:'25',bank_name:'',branch_code:'',account_number:'',account_type:'Savings',account_holder:'', spouse:{first_name:'',last_name:'',id_number:'',phone:'',employer:'',gross_salary:'',net_salary:'',additional_income:''}})
  const [idValidation, setIdValidation] = useState(null)
  const [dbMode, setDbMode] = useState(isSupabaseConfigured?'supabase':'local')

  useEffect(()=>{ localStorage.setItem('kredo-leads', JSON.stringify(leads)) },[leads])
  useEffect(()=>{ localStorage.setItem('kredo-agents', JSON.stringify(agents)) },[agents])

  useEffect(()=>{
    if(isSupabaseConfigured && session){
      (async()=>{
        const {data} = await supabase.from('leads').select('*').order('created_at',{ascending:false})
        if(data) setLeads(data)
        const {data:ag} = await supabase.from('agents').select('*')
        if(ag && ag.length) setAgents(ag)
      })()
    }
  },[session, dbMode])

  const handleLogin = async(e)=>{
    e.preventDefault()
    const found = agents.find(a=>a.email===loginForm.email)
    const demoAllowed = (loginForm.email==='admin@kredohub.co.za' && loginForm.password==='Admin123!') ||
                        (loginForm.email.includes('agent') && loginForm.password==='Agent123!') ||
                        (loginForm.email.includes('manager') && loginForm.password==='Manager123!')
    if(found || demoAllowed){
      const user = found || {email:loginForm.email, name: loginForm.email.split('@')[0], role: loginForm.email.includes('admin')?'Admin': loginForm.email.includes('manager')?'Manager':'Agent'}
      localStorage.setItem('kredo-session', JSON.stringify(user))
      setSession(user)
    } else alert('Invalid credentials. Use admin@kredohub.co.za / Admin123!')
  }

  const handleCreateAccount = async(e)=>{
    e.preventDefault()
    if(createForm.invite!=='CREDIT2024'){ alert('Invalid invite code. Use CREDIT2024'); return }
    if(createForm.password!==createForm.confirm){ alert('Passwords mismatch'); return }

    const newAgent = {
      id: Date.now().toString(),
      email:createForm.email,
      name:createForm.name,
      phone:createForm.phone,
      role:createForm.role,
      password_hash:createForm.password,
      status:'active',
      created_at:new Date().toISOString()
    }

    if(isSupabaseConfigured){
      const {error} = await supabase.from('agents').insert(newAgent)
      if(error){ alert('Supabase error: '+error.message); return }
    }

    setAgents([...agents, newAgent])
    alert('Account created! You can now login.')
    setShowCreate(false)
  }

  const handleIDChange = (val)=>{
    setLeadForm({...leadForm, id_number: val})

    if(val.length===13){
      const v = validateSAID(val)
      setIdValidation(v)

      if(v.valid) {
        setLeadForm(f=>({...f, dob: v.dob}))
      }
    } else {
      setIdValidation(null)
    }
  }

  const handleBankChange = (bank)=>{
    setLeadForm({...leadForm, bank_name: bank, branch_code: BANKS[bank]||''})
  }

  const handleSaveLead = async()=>{
    if(!leadForm.first_name || !leadForm.last_name || !leadForm.id_number){
      alert('First name, Last name, ID required')
      return
    }

    const newLead = {
      id: Date.now().toString(),
      ...leadForm,
      total_income: (parseFloat(leadForm.gross_salary)||0)+(parseFloat(leadForm.additional_income)||0),
      status:'new',
      created_at:new Date().toISOString()
    }

    if(isSupabaseConfigured){
      const {data, error} = await supabase.from('leads').insert(newLead).select()

      if(error){
        alert('Save failed: '+error.message)
        return
      }

      setLeads(data ? [...data, ...leads] : [newLead, ...leads])
    } else {
      setLeads([newLead, ...leads])
    }

    alert('Lead saved! ('+(isSupabaseConfigured?'Supabase':'localStorage')+')')
    setPage('leads')
  }

  /*
   * KREDO HUB THEME
   * Visual layer only.
   * Existing application logic remains unchanged.
   */
  const pcsStyles = `
  :root{
    --navy:#0b1f33;
    --navy2:#102b45;
    --gold:#b99253;
    --bg:#f4f5f7;
    --card:#fff;
    --muted:#6b7280;
    --line:#e5e7eb;
    --green:#198754;
    --amber:#d98b00;
    --red:#c73e3e;
    --blue:#3167b1;
  }

  *{
    box-sizing:border-box
  }

  html,body,#root{
    min-height:100%;
    margin:0
  }

  body{
    font-family:Inter,Arial,sans-serif;
    background:var(--bg);
    color:#18212b
  }

  .app{
    display:flex;
    min-height:100vh
  }

  .side{
    width:250px;
    background:linear-gradient(180deg,var(--navy) 0%,var(--navy2) 100%);
    color:#fff;
    padding:22px 14px;
    position:fixed;
    inset:0 auto 0 0;
    overflow:auto;
    z-index:10;
    box-shadow:4px 0 18px rgba(11,31,51,.12)
  }

  .brand{
    font-size:20px;
    font-weight:800;
    padding:8px 12px 25px;
    display:flex;
    align-items:center;
    gap:10px
  }

  .brand span{
    color:var(--gold)
  }

  .brand-icon{
    width:36px;
    height:36px;
    border-radius:9px;
    background:var(--gold);
    display:grid;
    place-items:center;
    color:#fff;
    font-weight:800;
    box-shadow:0 4px 10px rgba(185,146,83,.22)
  }

  .section{
    font-size:11px;
    color:#91a1b2;
    text-transform:uppercase;
    letter-spacing:.08em;
    padding:16px 12px 7px
  }

  .nav{
    display:flex;
    gap:11px;
    padding:10px 12px;
    border-radius:9px;
    color:#dbe4ed;
    cursor:pointer;
    margin:2px 0;
    font-size:13px;
    align-items:center;
    border:0;
    background:transparent;
    width:100%;
    text-align:left;
    transition:.15s ease
  }

  .nav.active,
  .nav:hover{
    background:rgba(185,146,83,.16);
    color:#fff
  }

  .nav.active{
    box-shadow:inset 3px 0 0 var(--gold)
  }

  .main{
    margin-left:250px;
    width:calc(100% - 250px);
    min-height:100vh;
    display:flex;
    flex-direction:column
  }

  .top{
    height:68px;
    background:#fff;
    border-bottom:1px solid var(--line);
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 30px
  }

  .crumb{
    font-weight:700;
    font-size:14px;
    color:var(--navy)
  }

  .user{
    display:flex;
    align-items:center;
    gap:10px;
    font-size:13px
  }

  .avatar{
    width:34px;
    height:34px;
    border-radius:50%;
    background:var(--gold);
    display:grid;
    place-items:center;
    color:#fff;
    font-weight:700
  }

  .content{
    padding:28px 30px;
    flex:1
  }

  .title{
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:22px;
    flex-wrap:wrap;
    gap:12px
  }

  .title h1{
    margin:0;
    font-size:25px;
    color:var(--navy)
  }

  .subtitle{
    color:var(--muted);
    font-size:13px;
    margin-top:5px
  }

  .btn{
    border:0;
    border-radius:8px;
    padding:10px 15px;
    font-weight:700;
    cursor:pointer;
    font-size:13px;
    transition:.15s ease
  }

  .btn:hover{
    transform:translateY(-1px)
  }

  .btn.primary{
    background:var(--gold);
    color:#fff;
    box-shadow:0 3px 8px rgba(185,146,83,.18)
  }

  .btn.primary:hover{
    background:#a98246
  }

  .btn.outline{
    background:#fff;
    border:1px solid var(--line);
    color:#18212b
  }

  .btn.dark{
    background:var(--navy);
    color:#fff
  }

  .cards{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:14px;
    margin-bottom:24px
  }

  .card{
    background:var(--card);
    border:1px solid var(--line);
    border-radius:11px;
    padding:17px;
    box-shadow:0 2px 7px rgba(11,31,51,.03)
  }

  .label{
    font-size:12px;
    color:var(--muted)
  }

  .num{
    font-size:25px;
    font-weight:800;
    margin-top:7px;
    color:var(--navy)
  }

  .trend{
    font-size:11px;
    margin-top:5px;
    color:var(--green)
  }

  .panel{
    background:#fff;
    border:1px solid var(--line);
    border-radius:11px;
    overflow:hidden;
    box-shadow:0 2px 7px rgba(11,31,51,.03)
  }

  .panelhead{
    padding:17px 19px;
    border-bottom:1px solid var(--line);
    display:flex;
    justify-content:space-between;
    align-items:center
  }

  .panelhead h2{
    font-size:15px;
    margin:0;
    color:var(--navy)
  }

  .table{
    width:100%;
    border-collapse:collapse;
    font-size:12px
  }

  .table th{
    text-align:left;
    color:#7b8490;
    font-weight:700;
    background:#fafafa
  }

  .table th,
  .table td{
    padding:13px 15px;
    border-bottom:1px solid var(--line)
  }

  .table tr:last-child td{
    border-bottom:0
  }

  .table tbody tr:hover{
    background:#faf9f6
  }

  .name{
    font-weight:700;
    color:var(--navy)
  }

  .small{
    font-size:11px;
    color:var(--muted);
    margin-top:3px
  }

  .badge{
    display:inline-block;
    padding:5px 8px;
    border-radius:999px;
    font-size:10px;
    font-weight:700
  }

  .gold{
    background:#f5ead8;
    color:#7d5b28
  }

  .blue{
    background:#e5edf9;
    color:#31598e
  }

  .green{
    background:#e3f3ea;
    color:#23734a
  }

  .amber{
    background:#fff1d7;
    color:#966000
  }

  .red{
    background:#fae6e6;
    color:#9c3333
  }

  .gray{
    background:#edf0f2;
    color:#5f6973
  }

  input,
  select,
  textarea{
    border:1px solid var(--line);
    border-radius:8px;
    padding:10px 12px;
    background:#fff;
    font-size:13px;
    width:100%;
    color:#18212b;
    outline:none;
    transition:border-color .15s,box-shadow .15s
  }

  input:focus,
  select:focus,
  textarea:focus{
    border-color:var(--gold);
    box-shadow:0 0 0 3px rgba(185,146,83,.10)
  }

  input::placeholder,
  textarea::placeholder{
    color:#9aa1a9
  }

  .grid3{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:14px
  }

  .form-section{
    margin-bottom:28px
  }

  .form-title{
    font-weight:800;
    font-size:13px;
    margin-bottom:12px;
    color:var(--navy);
    text-transform:uppercase;
    letter-spacing:.05em
  }

  .login-wrap{
    min-height:100vh;
    display:flex;
    background:var(--bg)
  }

  .login-left{
    width:480px;
    background:#fff;
    padding:40px;
    display:flex;
    flex-direction:column;
    justify-content:center
  }

  .login-right{
    flex:1;
    background:linear-gradient(135deg,var(--navy) 0%,#12325a 100%);
    display:flex;
    align-items:center;
    justify-content:center;
    padding:48px;
    color:#fff
  }

  @media(max-width:900px){
    .side{
      width:70px
    }

    .brand span.text{
      display:none
    }

    .nav span.label-text{
      display:none
    }

    .main{
      margin-left:70px;
      width:calc(100% - 70px)
    }

    .cards{
      grid-template-columns:repeat(2,1fr)
    }

    .grid3{
      grid-template-columns:1fr
    }

    .login-left{
      width:100%
    }

    .login-right{
      display:none
    }
  }
  `

  if(!session){
    return (
      <>
        <style>{pcsStyles}</style>

        <div className="login-wrap">

          <div className="login-left">

            <div
              className="brand"
              style={{paddingLeft:0}}
            >
              <div className="brand-icon">KH</div>

              <div>
                <div
                  style={{
                    fontSize:20,
                    fontWeight:800,
                    color:'#0b1f33'
                  }}
                >
                  Kredo Hub
                </div>

                <div
                  style={{
                    fontSize:11,
                    color:'#6b7280'
                  }}
                >
                  LIVE CRM
                </div>
              </div>
            </div>

            <div
              className="label"
              style={{marginTop:10}}
            >
              Live database • Agent logins • Real saving
            </div>

            <div
              className={`badge ${isSupabaseConfigured?'green':'amber'}`}
              style={{
                marginTop:10,
                display:'inline-flex'
              }}
            >
              {isSupabaseConfigured
                ?'● Supabase Connected'
                :'● Local Storage'}
            </div>

            <div
              style={{
                display:'flex',
                gap:8,
                margin:'20px 0'
              }}
            >
              <button
                onClick={()=>setShowCreate(false)}
                className={`btn ${!showCreate?'dark':'outline'}`}
                style={{flex:1}}
              >
                Login
              </button>

              <button
                onClick={()=>setShowCreate(true)}
                className={`btn ${showCreate?'dark':'outline'}`}
                style={{flex:1}}
              >
                Create Account
              </button>
            </div>

            {!showCreate ? (

              <form
                onSubmit={handleLogin}
                style={{
                  display:'flex',
                  flexDirection:'column',
                  gap:14
                }}
              >

                <input
                  required
                  placeholder="Email"
                  value={loginForm.email}
                  onChange={e=>setLoginForm({
                    ...loginForm,
                    email:e.target.value
                  })}
                />

                <input
                  required
                  type="password"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={e=>setLoginForm({
                    ...loginForm,
                    password:e.target.value
                  })}
                />

                <button
                  className="btn primary"
                  style={{padding:'12px'}}
                >
                  Sign In
                </button>

                <div
                  style={{
                    fontSize:11,
                    color:'#6b7280',
                    background:'#fafafa',
                    padding:12,
                    borderRadius:8,
                    border:'1px solid #e5e7eb'
                  }}
                >
                  <div
                    style={{
                      fontWeight:700,
                      marginBottom:4
                    }}
                  >
                    Demo logins:
                  </div>

                  admin@kredohub.co.za / Admin123!<br/>
                  manager@... / Manager123!<br/>
                  agent1@... / Agent123!
                </div>

              </form>

            ) : (

              <form
                onSubmit={handleCreateAccount}
                style={{
                  display:'flex',
                  flexDirection:'column',
                  gap:10
                }}
              >

                <input
                  required
                  placeholder="Full Name"
                  value={createForm.name}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    name:e.target.value
                  })}
                />

                <input
                  required
                  placeholder="Email"
                  value={createForm.email}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    email:e.target.value
                  })}
                />

                <input
                  placeholder="Phone"
                  value={createForm.phone}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    phone:e.target.value
                  })}
                />

                <select
                  value={createForm.role}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    role:e.target.value
                  })}
                >
                  <option>Agent</option>
                  <option>Manager</option>
                  <option>Admin</option>
                </select>

                <input
                  required
                  type="password"
                  placeholder="Password"
                  value={createForm.password}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    password:e.target.value
                  })}
                />

                <input
                  required
                  type="password"
                  placeholder="Confirm Password"
                  value={createForm.confirm}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    confirm:e.target.value
                  })}
                />

                <input
                  required
                  placeholder="Invite Code (CREDIT2024)"
                  value={createForm.invite}
                  onChange={e=>setCreateForm({
                    ...createForm,
                    invite:e.target.value
                  })}
                />

                <button className="btn dark">
                  Create Account
                </button>

              </form>
            )}

          </div>

          <div className="login-right">

            <div style={{maxWidth:420}}>

              <h2
                style={{
                  fontSize:34,
                  fontWeight:800,
                  lineHeight:1.1
                }}
              >
                All your clients, payments & agents in one live system
              </h2>

              <p
                style={{
                  marginTop:16,
                  color:'#dbe4ed',
                  fontSize:14,
                  lineHeight:1.6
                }}
              >
                Real Postgres saving. Every lead you add is instantly
                in Supabase. Role-based logins, branch codes, COP spouse
                logic, mandate PDFs.
              </p>

              <div
                style={{
                  marginTop:28,
                  display:'grid',
                  gridTemplateColumns:'1fr 1fr',
                  gap:12
                }}
              >

                <div
                  style={{
                    background:'rgba(255,255,255,0.08)',
                    padding:14,
                    borderRadius:12,
                    border:'1px solid rgba(255,255,255,0.1)',
                    fontSize:12
                  }}
                >
                  ✓ Province dropdown
                </div>

                <div
                  style={{
                    background:'rgba(255,255,255,0.08)',
                    padding:14,
                    borderRadius:12,
                    border:'1px solid rgba(255,255,255,0.1)',
                    fontSize:12
                  }}
                >
                  ✓ COP spouse salary
                </div>

                <div
                  style={{
                    background:'rgba(255,255,255,0.08)',
                    padding:14,
                    borderRadius:12,
                    border:'1px solid rgba(255,255,255,0.1)',
                    fontSize:12
                  }}
                >
                  ✓ Branch read-only
                </div>

                <div
                  style={{
                    background:'rgba(255,255,255,0.08)',
                    padding:14,
                    borderRadius:12,
                    border:'1px solid rgba(255,255,255,0.1)',
                    fontSize:12
                  }}
                >
                  ✓ Gross/Net/Additional
                </div>

              </div>

            </div>

          </div>

        </div>
      </>
    )
  }

  return (
    <>
      <style>{pcsStyles}</style>

      <div className="app">

        <div className="side">

          <div className="brand">

            <div className="brand-icon">
              KH
            </div>

            <span className="text">
              Kredo <span>Hub</span>
            </span>

          </div>

          <div className="section">
            Main
          </div>

          <button
            onClick={()=>setPage('dashboard')}
            className={`nav ${page==='dashboard'?'active':''}`}
          >
            📊
            <span className="label-text">
              Dashboard
            </span>
          </button>

          <button
            onClick={()=>setPage('leads')}
            className={`nav ${page==='leads'?'active':''}`}
          >
            👥
            <span className="label-text">
              Leads ({leads.length})
            </span>
          </button>

          <button
            onClick={()=>setPage('new-lead')}
            className={`nav ${page==='new-lead'?'active':''}`}
          >
            📝
            <span className="label-text">
              New Lead Form
            </span>
          </button>

          <button
            onClick={()=>setPage('clients')}
            className={`nav ${page==='clients'?'active':''}`}
          >
            💼
            <span className="label-text">
              Clients
            </span>
          </button>

          <div className="section">
            System
          </div>

          <button
            onClick={()=>setPage('agents')}
            className={`nav ${page==='agents'?'active':''}`}
          >
            👨‍💼
            <span className="label-text">
              Agents ({agents.length})
            </span>
          </button>

          <button
            onClick={()=>setPage('settings')}
            className={`nav ${page==='settings'?'active':''}`}
          >
            ⚙️
            <span className="label-text">
              Settings / Go Live
            </span>
          </button>

          <div
            style={{
              padding:'16px 12px',
              borderTop:'1px solid rgba(255,255,255,0.1)',
              marginTop:30
            }}
          >

            <div className="user">

              <div className="avatar">
                {session.name?.[0]||'A'}
              </div>

              <div>
                <div
                  style={{
                    fontSize:13,
                    fontWeight:700
                  }}
                >
                  {session.name}
                </div>

                <div
                  style={{
                    fontSize:11,
                    color:'#91a1b2'
                  }}
                >
                  {session.role}
                </div>
              </div>

            </div>

            <button
              onClick={()=>{
                localStorage.removeItem('kredo-session')
                setSession(null)
              }}
              className="btn outline"
              style={{
                width:'100%',
                marginTop:12,
                background:'rgba(255,255,255,0.08)',
                color:'#fff',
                borderColor:'rgba(255,255,255,0.15)'
              }}
            >
              Logout
            </button>

            <div
              className={`badge ${isSupabaseConfigured?'green':'amber'}`}
              style={{
                marginTop:12,
                width:'100%',
                textAlign:'center',
                justifyContent:'center',
                display:'flex'
              }}
            >
              {isSupabaseConfigured
                ?'Live • Supabase'
                :'Local • Ready for Cloud'}
            </div>

          </div>

        </div>

        <div className="main">

          <div className="top">

            <div className="crumb">
              {page.toUpperCase()} • kredohub.co.za/{page}
            </div>

            <div
              style={{
                display:'flex',
                gap:8,
                alignItems:'center'
              }}
            >

              <span className="badge green">
                ● Saved • Just now
              </span>

              <button
                onClick={()=>setPage('new-lead')}
                className="btn primary"
              >
                + New Lead
              </button>

            </div>

          </div>

          <div className="content">

            {page==='dashboard' && (
              <div>

                <div className="title">

                  <div>

                    <h1>
                      Dashboard
                    </h1>

                    <div className="subtitle">
                      Live from {isSupabaseConfigured?'Supabase Postgres':'localStorage'}
                      {' • '}
                      {leads.length} leads
                    </div>

                  </div>

                </div>

                <div className="cards">

                  {[
                    ['Active Leads', leads.length, '+12%'],
                    ['Waiting Payment', leads.filter(l=>l.status==='waiting_payment').length, ''],
                    ['Provinces', new Set(leads.map(l=>l.province)).size || 0, ''],
                    ['Agents', agents.length, '']
                  ].map(([label,num,trend])=>(

                    <div
                      key={label}
                      className="card"
                    >

                      <div className="label">
                        {label}
                      </div>

                      <div className="num">
                        {num}
                      </div>

                      <div className="trend">
                        {trend}
                      </div>

                    </div>

                  ))}

                </div>

                <div className="panel">

                  <div className="panelhead">

                    <h2>
                      Recent Leads (Live)
                    </h2>

                    <span className="badge gold">
                      {leads.length} total
                    </span>

                  </div>

                  <table className="table">

                    <thead>

                      <tr>
                        <th>Name</th>
                        <th>ID</th>
                        <th>Province</th>
                        <th>Bank</th>
                        <th>Income</th>
                      </tr>

                    </thead>

                    <tbody>

                      {leads.slice(0,5).map(l=>(

                        <tr key={l.id}>

                          <td>
                            <div className="name">
                              {l.first_name} {l.last_name}
                            </div>

                            <div className="small">
                              {l.phone}
                            </div>
                          </td>

                          <td>
                            {l.id_number||'—'}
                          </td>

                          <td>
                            <span className="badge blue">
                              {l.province||'—'}
                            </span>
                          </td>

                          <td>
                            {l.bank_name} ({l.branch_code})
                          </td>

                          <td>
                            <strong>
                              R{l.gross_salary}
                            </strong>

                            <div className="small">
                              Net R{l.net_salary}
                            </div>
                          </td>

                        </tr>

                      ))}

                      {leads.length===0 && (

                        <tr>

                          <td
                            colSpan={5}
                            style={{
                              textAlign:'center',
                              padding:24,
                              color:'#6b7280'
                            }}
                          >
                            No leads yet — add in New Lead Form
                          </td>

                        </tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

            {page==='leads' && (

              <div>

                <div className="title">

                  <div>

                    <h1>
                      Leads — {leads.length} saved
                      {' '}
                      {isSupabaseConfigured
                        ?'(Supabase)'
                        :'(localStorage)'}
                    </h1>

                    <div className="subtitle">
                      Kredo Hub Navy / Gold theme
                    </div>

                  </div>

                </div>

                <div className="panel">

                  <table className="table">

                    <thead>

                      <tr>
                        <th>Name</th>
                        <th>ID / DOB</th>
                        <th>Province</th>
                        <th>Bank</th>
                        <th>Gross/Net</th>
                        <th>Status</th>
                      </tr>

                    </thead>

                    <tbody>

                      {leads.map(l=>(

                        <tr key={l.id}>

                          <td>

                            <div className="name">
                              {l.first_name} {l.last_name}
                            </div>

                            <div className="small">
                              {l.phone} • {l.email}
                            </div>

                          </td>

                          <td>

                            {l.id_number}

                            <div className="small">
                              {l.dob}
                            </div>

                          </td>

                          <td>

                            <span className="badge blue">
                              {l.province}
                            </span>

                          </td>

                          <td>

                            {l.bank_name}

                            <div className="small">
                              {l.branch_code} • {l.account_number}
                            </div>

                          </td>

                          <td>

                            R{l.gross_salary} / R{l.net_salary}

                            <div className="small">
                              +R{l.additional_income||0}
                            </div>

                          </td>

                          <td>

                            <span className="badge gold">
                              {l.status}
                            </span>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

            {page==='new-lead' && (

              <div>

                <div className="title">

                  <div>

                    <h1>
                      New Lead Form
                    </h1>

                    <div className="subtitle">
                      Province dropdown • Marital COP logic • Gross/Net/Additional • Branch read-only • Saves to {isSupabaseConfigured?'Supabase':'localStorage'}
                    </div>

                  </div>

                </div>

                <div
                  className="panel"
                  style={{padding:20}}
                >

                  <div className="form-section">

                    <div className="form-title">
                      01 Personal Details
                    </div>

                    <div className="grid3">

                      <input
                        placeholder="First Name*"
                        value={leadForm.first_name}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          first_name:e.target.value
                        })}
                      />

                      <input
                        placeholder="Last Name*"
                        value={leadForm.last_name}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          last_name:e.target.value
                        })}
                      />

                      <div>

                        <input
                          placeholder="Identity Number (13 digits)*"
                          value={leadForm.id_number}
                          onChange={e=>handleIDChange(e.target.value)}
                          style={{
                            borderColor:
                              idValidation?.valid===false
                                ?'#c73e3e'
                                :''
                          }}
                        />

                        {idValidation && (

                          <div
                            className={`badge ${idValidation.valid?'green':'red'}`}
                            style={{
                              marginTop:6,
                              display:'inline-flex'
                            }}
                          >
                            {idValidation.valid
                              ?`Valid ✓ ${idValidation.dob} ${idValidation.gender}`
                              :idValidation.error}
                          </div>

                        )}

                      </div>

                      <input
                        type="date"
                        value={leadForm.dob}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          dob:e.target.value
                        })}
                      />

                      <select
                        value={leadForm.marital_status}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          marital_status:e.target.value
                        })}
                      >
                        {MARITAL.map(m=>(
                          <option key={m}>
                            {m}
                          </option>
                        ))}
                      </select>

                      <select
                        value={leadForm.province}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          province:e.target.value
                        })}
                      >
                        <option value="">
                          Select Province
                        </option>

                        {PROVINCES.map(p=>(
                          <option key={p}>
                            {p}
                          </option>
                        ))}
                      </select>

                      <input
                        placeholder="Phone Number*"
                        value={leadForm.phone}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          phone:e.target.value
                        })}
                      />

                      <input
                        placeholder="Email Address"
                        value={leadForm.email}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          email:e.target.value
                        })}
                      />

                      <input
                        placeholder="Physical Address"
                        value={leadForm.address}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          address:e.target.value
                        })}
                        style={{gridColumn:'span 2'}}
                      />

                      <input
                        placeholder="City"
                        value={leadForm.city}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          city:e.target.value
                        })}
                      />

                      <input
                        placeholder="Postal Code"
                        value={leadForm.postal_code}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          postal_code:e.target.value
                        })}
                      />

                      {(leadForm.marital_status==='Married' ||
                        leadForm.marital_status==='In Community of Property') && (

                        <select
                          value={leadForm.marriage_type}
                          onChange={e=>setLeadForm({
                            ...leadForm,
                            marriage_type:e.target.value
                          })}
                          style={{gridColumn:'span 3'}}
                        >

                          <option value="">
                            Select Marriage Type (COP Logic)
                          </option>

                          {MARRIAGE_TYPES.map(t=>(
                            <option key={t}>
                              {t}
                            </option>
                          ))}

                        </select>

                      )}

                    </div>

                    {leadForm.marital_status==='Married' &&
                     leadForm.marriage_type==='In Community of Property (COP)' && (

                      <div
                        style={{
                          marginTop:14,
                          padding:14,
                          background:'#f8f7f3',
                          borderRadius:10,
                          border:'1px solid #e5e7eb'
                        }}
                      >

                        <div
                          className="form-title"
                          style={{marginBottom:10}}
                        >
                          COP Spouse Details
                        </div>

                        <div className="grid3">

                          <input
                            placeholder="Spouse First Name"
                            value={leadForm.spouse.first_name}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                first_name:e.target.value
                              }
                            })}
                          />

                          <input
                            placeholder="Spouse Last Name"
                            value={leadForm.spouse.last_name}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                last_name:e.target.value
                              }
                            })}
                          />

                          <input
                            placeholder="Spouse ID"
                            value={leadForm.spouse.id_number}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                id_number:e.target.value
                              }
                            })}
                          />

                          <input
                            placeholder="Spouse Phone"
                            value={leadForm.spouse.phone}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                phone:e.target.value
                              }
                            })}
                          />

                          <input
                            placeholder="Spouse Employer"
                            value={leadForm.spouse.employer}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                employer:e.target.value
                              }
                            })}
                          />

                          <input
                            placeholder="Spouse Gross Salary"
                            type="number"
                            value={leadForm.spouse.gross_salary}
                            onChange={e=>setLeadForm({
                              ...leadForm,
                              spouse:{
                                ...leadForm.spouse,
                                gross_salary:e.target.value
                              }
                            })}
                          />

                        </div>

                      </div>

                    )}

                  </div>

                  <div className="form-section">

                    <div className="form-title">
                      02 Employment & Salary
                    </div>

                    <div className="grid3">

                      <input
                        placeholder="Employer Name"
                        value={leadForm.employer_name}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          employer_name:e.target.value
                        })}
                      />

                      <select
                        value={leadForm.employment_type}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          employment_type:e.target.value
                        })}
                      >
                        <option>Permanent</option>
                        <option>Contract</option>
                        <option>Self-Employed</option>
                        <option>Unemployed</option>
                      </select>

                      <select
                        value={leadForm.salary_date}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          salary_date:e.target.value
                        })}
                      >
                        {Array.from(
                          {length:31},
                          (_,i)=>(
                            <option
                              key={i+1}
                              value={i+1}
                            >
                              Salary Date: {i+1}
                            </option>
                          )
                        )}
                      </select>

                      <input
                        placeholder="Gross Salary (R)*"
                        type="number"
                        value={leadForm.gross_salary}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          gross_salary:e.target.value
                        })}
                      />

                      <input
                        placeholder="Net Salary (R)*"
                        type="number"
                        value={leadForm.net_salary}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          net_salary:e.target.value
                        })}
                      />

                      <input
                        placeholder="Additional Income (R)"
                        type="number"
                        value={leadForm.additional_income}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          additional_income:e.target.value
                        })}
                      />

                    </div>

                    <div
                      className="badge blue"
                      style={{marginTop:10}}
                    >
                      Total Income: R
                      {(
                        (parseFloat(leadForm.gross_salary)||0)+
                        (parseFloat(leadForm.additional_income)||0)
                      ).toLocaleString()}
                    </div>

                  </div>

                  <div className="form-section">

                    <div className="form-title">
                      03 Banking Details
                    </div>

                    <div className="grid3">

                      <select
                        value={leadForm.bank_name}
                        onChange={e=>handleBankChange(e.target.value)}
                      >

                        <option value="">
                          Select Bank*
                        </option>

                        {Object.keys(BANKS).map(b=>(
                          <option key={b}>
                            {b}
                          </option>
                        ))}

                      </select>

                      <div style={{position:'relative'}}>

                        <input
                          placeholder="Branch Code"
                          value={leadForm.branch_code}
                          readOnly
                          style={{
                            background:'#f4f5f7',
                            color:'#6b7280'
                          }}
                        />

                        <span
                          style={{
                            position:'absolute',
                            right:10,
                            top:10,
                            fontSize:11
                          }}
                        >
                          🔒 auto
                        </span>

                      </div>

                      <input
                        placeholder="Account Number*"
                        value={leadForm.account_number}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          account_number:e.target.value
                        })}
                      />

                      <select
                        value={leadForm.account_type}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          account_type:e.target.value
                        })}
                      >
                        <option>Savings</option>
                        <option>Transactional</option>
                        <option>Cheque Account</option>
                      </select>

                      <input
                        placeholder="Account Holder Name"
                        value={leadForm.account_holder}
                        onChange={e=>setLeadForm({
                          ...leadForm,
                          account_holder:e.target.value
                        })}
                        style={{gridColumn:'span 2'}}
                      />

                    </div>

                  </div>

                  <div
                    style={{
                      display:'flex',
                      gap:10
                    }}
                  >

                    <button
                      onClick={handleSaveLead}
                      className="btn primary"
                      style={{padding:'12px 22px'}}
                    >
                      Save Lead — Live to {isSupabaseConfigured?'Supabase':'Local'}
                    </button>

                    <button
                      onClick={()=>setPage('leads')}
                      className="btn outline"
                    >
                      Cancel
                    </button>

                  </div>

                </div>

              </div>
            )}

            {page==='agents' && (

              <div className="panel">

                <div className="panelhead">

                  <h2>
                    Agents ({agents.length}) — Live Table
                  </h2>

                </div>

                <table className="table">

                  <thead>

                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>

                  </thead>

                  <tbody>

                    {agents.map(a=>(

                      <tr key={a.id}>

                        <td>

                          <div className="name">
                            {a.email}
                          </div>

                          <div className="small">
                            {a.name}
                          </div>

                        </td>

                        <td>

                          <span className="badge blue">
                            {a.role}
                          </span>

                        </td>

                        <td>

                          <span className="badge green">
                            {a.status}
                          </span>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

            {page==='settings' && (

              <div style={{maxWidth:720}}>

                <div className="title">

                  <div>

                    <h1>
                      Settings / Go Live
                    </h1>

                    <div className="subtitle">
                      Mode: {isSupabaseConfigured
                        ?'Supabase Live'
                        :'LocalStorage fallback'}
                    </div>

                  </div>

                </div>

                <div
                  className="panel"
                  style={{padding:20}}
                >

                  <div className="label">
                    Database Status
                  </div>

                  <div
                    style={{
                      marginTop:8,
                      fontSize:13
                    }}
                  >
                    VITE_SUPABASE_URL:
                    {' '}
                    {import.meta.env.VITE_SUPABASE_URL
                      ?'Set ✓'
                      :'Missing'}

                    <br/>

                    VITE_SUPABASE_ANON_KEY:
                    {' '}
                    {import.meta.env.VITE_SUPABASE_ANON_KEY
                      ?'Set ✓'
                      :'Missing'}
                  </div>

                </div>

              </div>

            )}

          </div>

        </div>

      </div>
    </>
  )
}
