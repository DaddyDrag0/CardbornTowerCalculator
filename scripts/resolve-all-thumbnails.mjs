import fs from 'node:fs/promises'
const imageIdText=await fs.readFile('data/image-ids.js','utf8')
const imageMap=JSON.parse(imageIdText.replace(/^window\.CARDBORN_IMAGE_IDS=/,'').replace(/;\s*$/,''))
let map={}
try{map=JSON.parse((await fs.readFile('data/thumbnails.js','utf8')).replace(/^window\.CARDBORN_THUMBNAILS=/,'').replace(/;\s*$/,''))}catch{}
const placeholder='https://t4.rbxcdn.com/180DAY-92f01c392ee9a79829852ac02d3fb15a'
for(const [id,url] of Object.entries(map))if(!url||url===placeholder)delete map[id]
const ids=[...new Set(Object.values(imageMap).flat().filter(Boolean))]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
for(let i=0;i<ids.length;i+=20){
  const chunk=ids.slice(i,i+20),params=new URLSearchParams({assetIds:chunk.join(','),returnPolicy:'PlaceHolder',size:'420x420',format:'Png',isCircular:'false'})
  for(let attempt=0;attempt<4;attempt++){
    try{
      const res=await fetch(`https://thumbnails.roblox.com/v1/assets?${params}`,{headers:{Accept:'application/json'}})
      if(res.ok){
        const rows=(await res.json()).data||[]
        for(const row of rows)if(row?.imageUrl&&row.imageUrl!==placeholder)map[String(row.targetId)]=row.imageUrl
        break
      }
    }catch{}
    await sleep(350*(attempt+1))
  }
  await sleep(120)
}
const covered=Object.entries(imageMap).filter(([,pair])=>pair.some(id=>map[id])).length
await fs.writeFile('data/thumbnails.js',`window.CARDBORN_THUMBNAILS=${JSON.stringify(map,null,2)};\n`)
console.log(`STATIC_IMAGE_COVERAGE ${covered}/${Object.keys(imageMap).length}`)
console.log(`STATIC_MAP_ENTRIES ${Object.keys(map).length}`)
