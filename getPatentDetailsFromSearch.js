function usStateSwitch(str){
  var arr = [["Alabama","AL"],["Alaska","AK"],["Arizona","AZ"],["Arkansas","AR"],["California","CA"],["Colorado","CO"],["Connecticut","CT"],["Delaware","DE"],["District of Columbia","DC"],["District of Columbia","D.C."],["Florida","FL"],["Georgia","GA"],["Hawaii","HI"],["Idaho","ID"],["Illinois","IL"],["Indiana","IN"],["Iowa","IA"],["Kansas","KS"],["Kentucky","KY"],["Louisiana","LA"],["Maine","ME"],["Maryland","MD"],["Massachusetts","MA"],["Michigan","MI"],["Minnesota","MN"],["Mississippi","MS"],["Missouri","MO"],["Montana","MT"],["Nebraska","NE"],["Nevada","NV"],["New Hampshire","NH"],["New Jersey","NJ"],["New Mexico","NM"],["New York","NY"],["North Carolina","NC"],["North Dakota","ND"],["Ohio","OH"],["Oklahoma","OK"],["Oregon","OR"],["Pennsylvania","PA"],["Rhode Island","RI"],["South Carolina","SC"],["South Dakota","SD"],["Tennessee","TN"],["Texas","TX"],["Utah","UT"],["Vermont","VT"],["Virginia","VA"],["Washington","WA"],["West Virginia","WV"],["Wisconsin","WI"],["Wyoming","WY"],["American Samoa","AS"],["Guam","GU"],["Northern Mariana Islands","MP"],["Puerto Rico","PR"],["U.S. Virgin Islands","VI"],["U.S. Minor Outlying Islands","UM"],["Micronesia","FM"],["Marshall Islands","MH"],["Palau","PW"]];
  for(var i=0; i<arr.length; i++){
    if(str == arr[i][0] || str == arr[i][1]){
      return str.length > 2 ? arr[i][1] : arr[i][0];
    }
  }
}
async function multiFetchDoc(urls){
    const response_arr = [];
    let res = await Promise.all(urls.map(e => fetch(e)));
    let text = await Promise.all(res.filter(r=> (r.status > 199 && r.status < 305)).map(e => e.text()));
    return text.map(t=> new DOMParser().parseFromString(t,'text/html'));
}
async function handleMultiFetch(arr,type){
    let res = await Promise.all(arr.map(e => fetch(e.url,e.obj)));
    if(type == 'json') return await Promise.all(res.filter(r=> (r.status > 199 && r.status < 305)).map(e => e.json()));
    if(type == 'text') return await Promise.all(res.filter(r=> (r.status > 199 && r.status < 305)).map(e => e.text()));
    if(type == 'html') {
        let text = await Promise.all( res.filter(r=> (r.status > 199 && r.status < 305)).map(e => e.text()) );
        return text.map(t=> new DOMParser().parseFromString(t,'text/html'));
    } else { return false; }
}

async function getPatentAPI(queries){
    var docs = await handleMultiFetch(queries,'html');

    parsePatentSearchMultiRes(docs[0],queries);
}

async function parsePatentSearchMultiRes(doc,queries){
    var is_one_res = doc?.getElementsByTagName('tbody') && Array.from(doc.getElementsByTagName('tbody'))?.filter(tb=> /\(\s*1\s*of\s*1\s*\)/i.test(tb.innerText))?.length;

    var tmain = Array.from(doc.getElementsByTagName('tbody'))?.filter(t=> t.getElementsByTagName('td') && Array.from(t.getElementsByTagName('td'))?.some(td=> td.getAttribute('valign') == "baseline"));

    var table = tmain?.[0] && Array.from(tmain?.[0]?.getElementsByTagName('tr'));

    var tbody = table?.map(tr=> Array.from(tr.getElementsByTagName('a'))).map(aa=> { return {patent_number: aa[0]?.innerText?.replace(/\D+/g,''), patent_title: aa[1]?.innerText?.trim(), url: aa[0]?.href}}).filter(o=> o.patent_number).map(p=> {
        return {
            ...p,
            ...{url:`https://patft.uspto.gov/netacgi/nph-Parser?Sect1=PTO2&Sect2=HITOFF&u=%2Fnetahtml%2FPTO%2Fsearch-adv.htm&r=1&p=1&f=G&l=50&d=PTXT&S1=${p.patent_number}.PN.&OS=PN/${p.patent_number}&RS=PN/${p.patent_number}`},
        }
    });
    if(is_one_res) parsePatentSearchSingleRes(doc);
    else {
        var docs = await handleMultiFetch(tbody.map(o=> {return {...o,...{obj: {}}}}),'html');
        var parsed = docs.map(d=> parsePatentSearchSingleRes(d));
        console.log(parsed)
    }
}    

var cleanObject = (ob) => 
  Object.entries(ob).reduce((r, [k, v]) => {
    if(v != null && v != undefined && v !== "" && ( typeof v == 'boolean' || typeof v == 'string' || typeof v == 'symbol' || typeof v == 'number' || typeof v == 'function' || (typeof v == 'object'  && ((Array.isArray(v) && v.length) || (Array.isArray(v) != true)) ) ) ) { 
      r[k] = v; 
      return r;
    } else { 
     return r; 
    }
  }, {});


function parsePatentSearchSingleRes(doc){
    var tables = Array.from(doc.getElementsByTagName('tbody')).filter(t=> t.innerText.trim());
    let basic_head_tds = tables.filter(tb=> /^united states patent/i.test(tb.getElementsByTagName('tr')?.[0]?.innerText?.trim()))?.[0]?.getElementsByTagName('tr')?.[1]?.getElementsByTagName('td');
    let patent_number = tables.filter(tb=> /^united states patent/i.test(tb.getElementsByTagName('tr')?.[0]?.innerText?.trim()))?.[0]?.getElementsByTagName('tr')?.[0]?.getElementsByTagName('td')?.[1].innerText?.replace(/\D+/g,'')?.trim();
    let last_update = basic_head_tds?.[1].innerText?.trim();
    let main_patent_holder_lastname = basic_head_tds?.[0]?.innerText?.replace(/,\s+et\s+al\./,'')?.trim();
    let patent_title = Array.from(doc.getElementsByTagName('font')).filter(f=> f.getAttribute('size') =='+1')?.[0]?.innerText;
    let abstract = Array.from(doc.getElementsByTagName('center'))?.filter(center=> /^Abstract$/.test(center.innerText.trim()))?.[0]?.nextElementSibling?.innerText;
    let detail_basics = tables.filter(tb=> /Inventors:/i.test(tb.getElementsByTagName('th')?.[0]?.innerText) )?.[0]?.getElementsByTagName('tr')?.[0] && Array.from(tables.filter(tb=> /Inventors:/i.test(tb.getElementsByTagName('th')?.[0]?.innerText) )?.[0]?.getElementsByTagName('tr')).map(tr=> {
        let o = {};
        let val = tr.getElementsByTagName('td')?.[0]?.innerText?.trim();
        o[tr.getElementsByTagName('th')?.[0]?.innerText?.replace(/:/,'')?.trim()?.replace(/\W+/g,'_')?.toLowerCase()] = val;
        return o;
    })?.reduce((a,b)=> {return {...a,...b}} )
    var output = cleanObject({
        ...{
            patent_number: patent_number,
            last_update: last_update,
            main_patent_holder_lastname: main_patent_holder_lastname,
            patent_title: patent_title,
            abstract: abstract,
        },
        ...detail_basics,
        ...(detail_basics?.inventors ? {inventors: detail_basics?.inventors?.split(/\),/)?.map(ii=> {
            return cleanObject({
                firstname: /(?<=;\s+)\S+/.exec(ii)?.[0]?.trim(),
                middlename: /(?<=\s+)\S+(?=\s+\()/.exec(ii)?.[0]?.trim(),
                lastname: /^.+?(?=;)/.exec(ii)?.[0]?.replace(/,.+/)?.trim(),
                suffix: /(?<=,)\w+/.exec(/^.+?(?=;)/.exec(ii)?.[0]?.trim())?.[0],
                location: /(?<=\().+/.exec(ii)?.[0]?.replace(/\)/,''),
                city: /.+?(?=,\s+[A-Z]{2}$)/.exec(/(?<=\().+/.exec(ii)?.[0]?.replace(/\)/,''))?.[0],
                state_abbr: /[A-Z]{2}$/.exec(/(?<=\().+/.exec(ii)?.[0]?.replace(/\)/,''))?.[0],
                state: /[A-Z]{2}$/.exec(/(?<=\().+/.exec(ii)?.[0]?.replace(/\)/,''))?.[0] ? usStateSwitch(/[A-Z]{2}$/.exec(/(?<=\().+/.exec(ii)?.[0]?.replace(/\)/,''))?.[0]) : '',
                is_primary: /^.+?(?=;)/.exec(ii)?.[0]?.replace(/,.+/)?.trim()?.toLowerCase() == main_patent_holder_lastname?.toLowerCase(),
            })
        })} : {}),
        ...(detail_basics?.assignee ? {assignee: detail_basics?.assignee?.replace(/\s+\(.+?\)$/,''), assignee_location:/(?<=\().+?(?=\))/.exec(detail_basics?.assignee)?.[0] } : {}),
    })
    
    return output;
}

getPatentAPI([{url:window.location.href,obj:{}}]);
