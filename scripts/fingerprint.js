const fs=require("fs"),path=require("path"),JSZip=require("jszip");
(async()=>{
  const zip=await JSZip.loadAsync(fs.readFileSync(process.argv[2]));
  const out=[];
  const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a,b)=>+a.match(/(\d+)/)[1]-+b.match(/(\d+)/)[1]);
  for(const n of names){
    const x=await zip.file(n).async("string");
    const runs=(x.match(/<a:t>([^<]*)<\/a:t>/g)||[]).map(s=>s.slice(5,-6));
    const sizes=[...new Set((x.match(/sz="\d+"/g)||[]))].sort();
    const offs=(x.match(/<a:off x="-?\d+" y="-?\d+"\/>/g)||[]).length;
    out.push(`${n}|runs=${runs.length}|text=${runs.join("~")}|sizes=${sizes.join(",")}|shapes=${offs}`);
  }
  out.push("media="+Object.keys(zip.files).filter(n=>/^ppt\/media\//.test(n)).length);
  out.push("notes="+Object.keys(zip.files).filter(n=>/^ppt\/notesSlides\/notesSlide/.test(n)).length);
  console.log(out.join("\n"));
})();
