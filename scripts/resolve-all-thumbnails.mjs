import fs from 'node:fs/promises'
const imageIdText=await fs.readFile('data/image-ids.js','utf8')
const imageMap=JSON.parse(imageIdText.replace(/^window\.CARDBORN_IMAGE_IDS=/,'').replace(/;\s*$/,''))
let map={}
try{map=JSON.parse((await fs.readFile('data/thumbnails.js','utf8')).replace(/^window\.CARDBORN_THUMBNAILS=/,'').replace(/;\s*$/,''))}catch{}
const placeholder='https://t4.rbxcdn.com/180DAY-92f01c392ee9a79829852ac02d3fb15a'
for(const [id,url] of Object.entries(map))if(!url||url===placeholder)delete map[id]
const ids=[...new Set(Object.values(imageMap).flat().filter(Boolean))]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

async function thumbnailRows(chunk){
  const params=new URLSearchParams({assetIds:chunk.join(','),returnPolicy:'PlaceHolder',size:'420x420',format:'Png',isCircular:'false'})
  for(let attempt=0;attempt<4;attempt++){
    try{
      const res=await fetch(`https://thumbnails.roblox.com/v1/assets?${params}`,{headers:{Accept:'application/json'}})
      if(res.ok)return (await res.json()).data||[]
    }catch{}
    await sleep(350*(attempt+1))
  }
  return[]
}

for(let i=0;i<ids.length;i+=20){
  const rows=await thumbnailRows(ids.slice(i,i+20))
  for(const row of rows)if(row?.imageUrl&&row.imageUrl!==placeholder)map[String(row.targetId)]=row.imageUrl
  await sleep(100)
}

async function resolveOneViaDelivery(originalId,depth=0){
  if(depth>2)return null
  try{
    const res=await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${originalId}`,{redirect:'follow',headers:{'User-Agent':'CardbornThumbnailResolver/1.0'}})
    if(!res.ok)return null
    const ct=(res.headers.get('content-type')||'').toLowerCase()
    if(ct.startsWith('image/')){
      const u=res.url
      if(/^https:\/\/[^/]*rbxcdn\.com\//i.test(u))return u
      return `https://assetdelivery.roblox.com/v1/asset/?id=${originalId}`
    }
    const buf=Buffer.from(await res.arrayBuffer())
    if(buf.length>2_000_000)return null
    const text=buf.toString('utf8')
    const children=new Set()
    for(const m of text.matchAll(/(?:rbxassetid:\/\/|[?&]id=)(\d+)/gi))if(m[1]!==String(originalId))children.add(m[1])
    for(const child of children){
      const rows=await thumbnailRows([child])
      const row=rows.find(x=>String(x.targetId)===String(child)&&x.imageUrl&&x.imageUrl!==placeholder)
      if(row)return row.imageUrl
      const nested=await resolveOneViaDelivery(child,depth+1)
      if(nested)return nested
    }
  }catch{}
  return null
}

const missing=ids.filter(id=>!map[id])
let deliveryResolved=0
for(let i=0;i<missing.length;i++){
  const id=missing[i],url=await resolveOneViaDelivery(id)
  if(url){map[id]=url;deliveryResolved++}
  if(i%8===7)await sleep(150)
}

const covered=Object.entries(imageMap).filter(([,pair])=>pair.some(id=>map[id])).length
await fs.writeFile('data/thumbnails.js',`window.CARDBORN_THUMBNAILS=${JSON.stringify(map,null,2)};\n`)
console.log(`STATIC_IMAGE_COVERAGE ${covered}/${Object.keys(imageMap).length}`)
console.log(`STATIC_MAP_ENTRIES ${Object.keys(map).length}`)
console.log(`ASSET_DELIVERY_RESOLVED ${deliveryResolved}/${missing.length}`)
