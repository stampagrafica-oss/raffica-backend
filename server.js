require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const app = express();
app.use(cors());
app.use(express.json({limit:'5mb'}));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
function needShop(req,res,next){ if(!req.headers['x-shop-id']) return res.status(401).json({error:'shop mancante'}); next(); }
app.get('/health',(req,res)=>res.json({ok:true}));
app.get('/api/products', needShop, async (req,res)=>{
  const {data,error}=await supabase.from('products').select('*').eq('shop_id',req.headers['x-shop-id']);
  if(error) return res.status(400).json({error:error.message}); res.json(data);
});
app.post('/api/products', needShop, async (req,res)=>{
  const {data,error}=await supabase.from('products').insert({...req.body, shop_id:req.headers['x-shop-id']}).select().single();
  if(error) return res.status(400).json({error:error.message}); res.json(data);
});
app.post('/api/receipts', needShop, async (req,res)=>{
  const {data,error}=await supabase.from('receipts').insert({...req.body, shop_id:req.headers['x-shop-id']}).select().single();
  if(error) return res.status(400).json({error:error.message}); res.json({ok:true, receipt:data, telematico:'simulato - collegare fornitore AdE'});
});
app.get('/api/reports', needShop, async (req,res)=>{
  const {da,a,tipo}=req.query; const shop=req.headers['x-shop-id'];
  let q=supabase.from('receipts').select('*').eq('shop_id',shop);
  if(da) q=q.gte('data',da); if(a) q=q.lte('data',a);
  const {data,error}=await q; if(error) return res.status(400).json({error:error.message});
  const totale=data.reduce((s,r)=>s+Number(r.totale||0),0);
  res.json({tipo, totale, count:data.length, rows:data});
});
app.get('/api/shops', async (req,res)=>{
  if(req.headers['x-admin']!=='1') return res.status(403).json({error:'solo admin'});
  const {data}=await supabase.from('shops').select('*').order('data_registrazione',{ascending:false}); res.json(data);
});
app.post('/api/shops/attiva', async (req,res)=>{
  if(req.headers['x-admin']!=='1') return res.status(403).json({error:'solo admin'});
  const {shop_id, durata_giorni, scadenza}=req.body;
  const data_scadenza = scadenza || new Date(Date.now()+durata_giorni*864e5).toISOString();
  const {data,error}=await supabase.from('shops').update({stato:'Attivo', data_attivazione:new Date().toISOString(), data_scadenza, durata_giorni}).eq('id',shop_id).select().single();
  if(error) return res.status(400).json({error:error.message});
  await supabase.from('shop_history').insert({shop_id, azione:'Attivato', durata_giorni, operatore_admin:'Admin'});
  res.json(data);
});
const PORT=process.env.PORT||3001;
app.listen(PORT,()=>console.log('Raffica backend su '+PORT));
