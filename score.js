(() => {
  'use strict';

  const TEAM_A = 0, TEAM_B = 1;
  const $ = (id) => document.getElementById(id);

  // Setup inputs
  const elTeamAName=$('teamAName'), elTeamBName=$('teamBName'),
        elOversPer=$('oversPerInnings'), elWktsPer=$('wicketsPerInnings'),
        elStart=$('startMatch'), elNewMatch=$('newMatch');

  // Cards
  const elNameA=$('nameA'), elRunsA=$('runsA'), elWktsA=$('wktsA'), elOversA=$('oversA'), elRRA=$('rrA'),
        elHintA=$('hintA'), elExtrasA=$('extrasA'), elWDA=$('wdA'), elNBA=$('nbA'), elBadgeA=$('badgeA');
  const elNameB=$('nameB'), elRunsB=$('runsB'), elWktsB=$('wktsB'), elOversB=$('oversB'), elRRB=$('rrB'),
        elHintB=$('hintB'), elExtrasB=$('extrasB'), elWDB=$('wdB'), elNBB=$('nbB'), elBadgeB=$('badgeB');
  const elOversAList=$('oversAList'), elOversBList=$('oversBList');

  // Chase
  const elChaseBox=$('chaseBox'), elTargetVal=$('targetVal'), elNeedVal=$('needVal'),
        elBallsLeft=$('ballsLeftVal'), elReqRR=$('reqRR');

  // Status
  const elStatus=$('status');

  // Controls
  const btn = {
    dot:$('dot'), r1:$('r1'), r2:$('r2'), r3:$('r3'), r4:$('r4'), r6:$('r6'),
    wkt:$('wkt'), wd:$('wd'), nb:$('nb'), undo:$('undo'), end:$('endInnings')
  };
  const scoringBtnIds=['dot','r1','r2','r3','r4','r6','wkt','wd','nb','end'];

  // Helpers
  const oversStr=(b)=>`${Math.floor(b/6)}.${b%6}`;
  const rr=(r,b)=>b>0?(r/(b/6)):null;
  const fmtRR=(n)=>(n==null||!isFinite(n))?'—':n.toFixed(2);
  const totalExtras=(inn)=>inn.wides+inn.noballs;
  const makeOver=()=>({balls:[],runs:0,wkts:0});
  const blankInnings=(name)=>({name,runs:0,wickets:0,balls:0,wides:0,noballs:0,concluded:false,overs:[],currOver:makeOver()});

  // Match state
  const match={maxOvers:null,maxBalls:null,maxWickets:10,batting:TEAM_A,
               innings:[blankInnings('Team A'),blankInnings('Team B')],
               started:false,matchOver:false,target:null};

  // Undo
  const history=[];
  const snapshot=()=>JSON.parse(JSON.stringify(match));
  const pushHistory=()=>history.push(snapshot());
  function undoLast(){if(!history.length)return;Object.assign(match,history.pop());render();}

  const curr=()=>match.innings[match.batting];
  function setScoringEnabled(en){scoringBtnIds.forEach(id=>btn[id].disabled=!en);}
  function updateUndoEnabled(){btn.undo.disabled=history.length===0;}
  function setBadge(el,t,cls){el.textContent=t;el.className='badge';if(cls)el.classList.add(cls);}
  function finalizeCurrentOver(inn){if(inn.currOver&&inn.currOver.balls.length){inn.overs.push(inn.currOver);inn.currOver=makeOver();}}
  function recordBall(inn,token,runsDelta=0,{isLegal=false,isWicket=false}={}){inn.currOver.balls.push(token);if(runsDelta)inn.currOver.runs+=runsDelta;if(isWicket)inn.currOver.wkts+=1;if(isLegal&&inn.balls%6===0)finalizeCurrentOver(inn);}

  // Wicket with prompt
  // Show popup
function wicket() {
  if (!ensureInningsOpen()) return;
  pushHistory();
  $('wicketPopup').classList.remove('hidden');
}

// Handle popup choice
document.querySelectorAll('#wicketPopup .popup-buttons button').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    const c = curr();
    if (c.wickets < match.maxWickets) {
      let runs = 0;
      if (type === "1+RO") { runs = 1; c.runs += 1; }
      if (type === "2+RO") { runs = 2; c.runs += 2; }
      c.wickets += 1;
      c.balls += 1;
      recordBall(c, type, runs, { isLegal:true, isWicket:true });
      afterAction();
    }
    $('wicketPopup').classList.add('hidden');
  });
});

// Cancel button
$('closePopup').addEventListener('click', () => {
  history.pop(); // undo snapshot
  $('wicketPopup').classList.add('hidden');
});


  // Other actions
  function addRuns(r){if(!ensureInningsOpen())return;pushHistory();const c=curr();c.runs+=r;c.balls+=1;recordBall(c,String(r),r,{isLegal:true});afterAction();}
  function wide(){if(!ensureInningsOpen())return;pushHistory();const c=curr();c.runs+=1;c.wides+=1;recordBall(c,'Wd',1,{isLegal:false});afterAction();}
  function noBall(){if(!ensureInningsOpen())return;pushHistory();const c=curr();c.runs+=1;c.noballs+=1;recordBall(c,'Nb',1,{isLegal:false});afterAction();}
  function endInningsManual(){if(!match.started||curr().concluded||match.matchOver)return;pushHistory();closeCurrentInnings();render();}

  // Auto checks
  function autoChecks(){const c=curr();if(match.maxBalls!=null&&c.balls>=match.maxBalls)return closeCurrentInnings();if(c.wickets>=match.maxWickets)return closeCurrentInnings();if(match.batting===TEAM_B&&match.target!=null){const B=match.innings[TEAM_B];if(B.runs>=match.target){match.matchOver=true;B.concluded=true;finalizeCurrentOver(B);elStatus.textContent=`✅ ${B.name} win!`;setScoringEnabled(false);}}}
  function closeCurrentInnings(){const c=curr();if(c.concluded)return;finalizeCurrentOver(c);c.concluded=true;if(match.batting===TEAM_A){match.target=match.innings[TEAM_A].runs+1;match.batting=TEAM_B;elStatus.textContent=`Second innings begins. ${match.innings[TEAM_B].name} need ${match.target} to win.`;}else{decideMatch();}}
  function decideMatch(){const A=match.innings[TEAM_A],B=match.innings[TEAM_B];match.matchOver=true;if(B.runs>A.runs)elStatus.textContent=`✅ ${B.name} win.`;else if(B.runs<A.runs){const m=A.runs-B.runs;elStatus.textContent=`✅ ${A.name} won by ${m} run${m>1?'s':''}.`;}else elStatus.textContent='⏸️ Match tied.';setScoringEnabled(false);}
  function ensureInningsOpen(){const c=curr();if(match.maxBalls!=null&&c.balls>=match.maxBalls){closeCurrentInnings();render();return false;}if(c.concluded||match.matchOver||!match.started)return false;return true;}
  function afterAction(){autoChecks();render();}

  // Render overs
  function renderOvers(inn,el){if(!el)return;const list=inn.currOver.balls.length&&!inn.concluded?[...inn.overs,{...inn.currOver,live:true}]:[...inn.overs];if(list.length===0){el.innerHTML='<div class="over-empty">No overs yet.</div>';return;}el.innerHTML=list.slice(-5).map((ov,idx)=>{const ovNum=list.length-5+idx+1;const balls=ov.balls.map(t=>{let cls='';if(['W','C','B','RO','LBW','ST','HT'].includes(t)||t.includes('+RO'))cls='W';else if(t==='4')cls='b4';else if(t==='6')cls='b6';else if(t.toLowerCase()==='wd')cls='wd';else if(t.toLowerCase()==='nb')cls='nb';return `<span class="ball ${cls}">${t}</span>`;}).join(' ');return `<div class="over-row"><span class="ov-no">Ov ${ovNum}${ov.live?' (live)':''}</span><span class="ov-balls">${balls}</span><span class="ov-tally">${ov.runs}/${ov.wkts}</span></div>`;}).join('');}

  // Render UI
  function render(){const A=match.innings[TEAM_A],B=match.innings[TEAM_B];elNameA.textContent=A.name;elNameB.textContent=B.name;elRunsA.textContent=A.runs;elWktsA.textContent=A.wickets;elOversA.textContent=oversStr(A.balls);elRRA.textContent=A.balls?`(RR:${fmtRR(rr(A.runs,A.balls))})`:'';elHintA.textContent=`Balls this over:${A.balls%6}/6`;elExtrasA.textContent=totalExtras(A);elWDA.textContent=A.wides;elNBA.textContent=A.noballs;elRunsB.textContent=B.runs;elWktsB.textContent=B.wickets;elOversB.textContent=oversStr(B.balls);elRRB.textContent=B.balls?`(RR:${fmtRR(rr(B.runs,B.balls))})`:'';elHintB.textContent=`Balls this over:${B.balls%6}/6`;elExtrasB.textContent=totalExtras(B);elWDB.textContent=B.wides;elNBB.textContent=B.noballs;if(!match.started)elStatus.textContent='Set up the match to begin.';else if(!match.matchOver){if(match.batting===TEAM_A)elStatus.textContent=`${A.name} are batting.`;else elStatus.textContent=`${B.name} need ${Math.max(0,match.target-B.runs)} off ${Math.max(0,match.maxBalls-B.balls)} balls.`;}setScoringEnabled(match.started&&!match.matchOver&&!curr().concluded);updateUndoEnabled();renderOvers(A,elOversAList);renderOvers(B,elOversBList);}
  function startMatch(){const nameA=(elTeamAName.value||'Team A').trim(),nameB=(elTeamBName.value||'Team B').trim(),overs=parseInt(elOversPer.value,10),wkts=parseInt(elWktsPer.value,10);if(!overs||overs<1)return alert('Enter valid overs');match.maxOvers=overs;match.maxBalls=overs*6;match.maxWickets=wkts>=1?wkts:10;match.innings=[blankInnings(nameA),blankInnings(nameB)];match.batting=TEAM_A;match.started=true;match.matchOver=false;match.target=null;history.length=0;elStatus.textContent=`Match started. ${nameA} batting first.`;render();}
  function newMatch(){elTeamAName.value=elTeamBName.value=elOversPer.value=elWktsPer.value='';Object.assign(match,{maxOvers:null,maxBalls:null,maxWickets:10,batting:TEAM_A,innings:[blankInnings('Team A'),blankInnings('Team B')],started:false,matchOver:false,target:null});history.length=0;render();}

  // Wire events
  elStart.addEventListener('click',startMatch);elNewMatch.addEventListener('click',newMatch);
  btn.dot.addEventListener('click',()=>addRuns(0));btn.r1.addEventListener('click',()=>addRuns(1));btn.r2.addEventListener('click',()=>addRuns(2));
  btn.r3.addEventListener('click',()=>addRuns(3));btn.r4.addEventListener('click',()=>addRuns(4));btn.r6.addEventListener('click',()=>addRuns(6));
  btn.wkt.addEventListener('click',wicket);btn.wd.addEventListener('click',wide);btn.nb.addEventListener('click',noBall);
  btn.undo.addEventListener('click',undoLast);btn.end.addEventListener('click',endInningsManual);

  // Refresh
  const elRefresh=$('refreshBtn'), elLastUpdated=$('lastUpdated');
  function refreshScores(){render();elLastUpdated.textContent='Last updated: '+new Date().toLocaleTimeString();}
  if(elRefresh)elRefresh.addEventListener('click',refreshScores);

  render();
})();
