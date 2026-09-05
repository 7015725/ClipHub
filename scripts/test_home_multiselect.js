var fs = require('fs'), vm = require('vm'), assert = require('assert'), zlib = require('zlib');
var path = process.argv[2];
var source = fs.readFileSync(path || 'src/ch_11_filter.js', 'utf8');
if (!path) {
    var assignment = source.match(/var PACKED_B64\s*=([\s\S]*?);/)[1];
    source = zlib.gunzipSync(Buffer.from(vm.runInNewContext(assignment), 'base64')).toString('utf8');
}
function load(name, context) {
    var start = source.indexOf('    function ' + name + '(');
    assert(start >= 0, 'Missing real Filter function: ' + name);
    var end = source.indexOf('\n    function ', start + 5);
    vm.runInContext(source.slice(start, end), context);
}
var calls = [], notices = [], c = vm.createContext({
    homeMulti: {active:false, ids:[], confirmation:null, generation:0, busy:false, message:''},
    HOME_MULTI_LIMIT:100, homeMultiBar:null, resultCardHolders:[],
    rootMode:true, state:{panelAttached:true}, primaryShellPageId:'', previewRows:[{id:1},{id:2}],
    cancelActiveSwipe:function(){}, hideKeyboardOnMain:function(){},
    refreshPrimarySystemBack:function(){}, syncHomeMultiUi:function(){},
    rememberDeleteUndo:function(row){notices.push(row);}, attachDeleteUndoBanner:function(){},
    refreshPrimaryResults:function(){},
    ClipHub:{List:{deleteItems:function(ids){calls.push(ids.slice()); return {count:ids.length,itemIds:ids.slice(),deletedAt:1};}}}
});
['homeMultiIds','exitHomeMulti','beginHomeMulti','toggleHomeMulti','selectLoadedHomeMulti','requestHomeMultiDelete','cancelHomeMultiConfirm','confirmHomeMultiDelete','backHomeMulti'].forEach(function(name){load(name,c);});
assert.strictEqual(c.beginHomeMulti(),true);
c.toggleHomeMulti(1); assert.deepStrictEqual(Array.from(c.homeMultiIds()),[1]);
c.toggleHomeMulti(1); assert.strictEqual(c.homeMultiIds().length,0);
assert.strictEqual(c.requestHomeMultiDelete(),false); assert.strictEqual(calls.length,0);
c.selectLoadedHomeMulti(); c.previewRows.push({id:3}); assert.deepStrictEqual(Array.from(c.homeMultiIds()),[1,2]);
var snapshot=c.requestHomeMultiDelete(); assert.strictEqual(c.toggleHomeMulti(3),false);
c.cancelHomeMultiConfirm(); assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false);
snapshot=c.requestHomeMultiDelete(); assert.strictEqual(c.confirmHomeMultiDelete(snapshot),true);
assert.deepStrictEqual(Array.from(calls[0]),[1,2]); assert.strictEqual(notices[0].count,2);
assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false);
c.beginHomeMulti(); c.toggleHomeMulti(3); snapshot=c.requestHomeMultiDelete();
c.ClipHub.List.deleteItems=function(){throw new Error('database locked');};
assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false); assert.deepStrictEqual(Array.from(c.homeMultiIds()),[3]);
assert(c.homeMulti.message.indexOf('删除失败')>=0);
c.requestHomeMultiDelete(); assert.strictEqual(c.backHomeMulti(),true); assert(c.homeMulti.active); assert.strictEqual(c.homeMulti.confirmation,null);
assert.strictEqual(c.backHomeMulti(),true); assert.strictEqual(c.homeMulti.active,false);
c.beginHomeMulti(); c.toggleHomeMulti(1); snapshot=c.requestHomeMultiDelete(); c.exitHomeMulti(); c.beginHomeMulti(); c.toggleHomeMulti(2);
assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false); assert.deepStrictEqual(Array.from(c.homeMultiIds()),[2]);
c.exitHomeMulti(); c.previewRows=[]; for(var i=1;i<=120;i+=1)c.previewRows.push({id:i}); c.beginHomeMulti(); c.selectLoadedHomeMulti(); assert.strictEqual(c.homeMultiIds().length,100);
console.log('PASS real Filter multiselect: select/toggle, loaded boundary, zero, confirmation snapshot, cancel, batch delete, failure, Back, close generation, cap');
function FakeView() {
    var data={children:[], text:'', enabled:true};
    return new Proxy(data,{get:function(target,key){
        if(key in target)return target[key];
        return function(value){
            if(key==='addView')target.children.push(value);
            if(key==='getChildAt')return target.children[value];
            if(key==='removeAllViews')target.children=[];
            if(key==='setText')target.text=value;
            if(key==='setVisibility')target.visibility=value;
            if(key==='setEnabled')target.enabled=value;
            if(key==='setOnClickListener')target.click=value.onClick;
            if(key==='setOnLongClickListener')target.longClick=value.onLongClick;
            return this;
        };
    }});
}
FakeView.LayoutParams=function(){};
FakeView.LayoutParams.MATCH_PARENT=-1; FakeView.LayoutParams.WRAP_CONTENT=-2;
c.LinearLayout=FakeView; c.FrameLayout=FakeView; c.appContext={};
c.JavaAdapter=function(type,adapter){return adapter;}; c.View={VISIBLE:0,GONE:8};
c.Gravity={}; c.TextUtils={TruncateAt:{END:1}}; c.dp=function(n){return n;};
c.isMainThread=function(){return true;}; c.palette=function(){return {};};
c.makeText=function(text){var v=new FakeView();v.setText(text);return v;};
c.makeSecondaryButton=c.makeText; c.makeSwipeAction=c.makeText;
c.makeSourceIcon=function(){return new FakeView();};
c.makeCardActionButton=function(kind,desc,colors,danger,metrics,callback){var v=new FakeView();v.click=callback;return v;};
c.roundedBackground=function(){}; c.resultPreviewText=function(row){return String(row.id);};
c.tagsForResult=function(){return [];}; c.tagSummary=function(){return '';};
c.sourceLabel=function(){return '';}; c.formatTime=function(){return '';};
c.resultCardMetrics=function(){return new Proxy({},{get:function(){return 20;}});};
c.pxToDp=function(n){return n;}; c.SELECTION_ENABLED=false;c.selectedItemId=null;
c.resultActionViews=[]; c.resultCardViews=[]; c.scrollPerformanceState={};
c.bindSwipeGesture=function(){}; c.currentCardHolderRow=function(h){return h.row;};
var inputCount=0, tokenCount=0;
c.inputResultRow=function(){inputCount+=1;}; c.openTokenizerForResultRow=function(){tokenCount+=1;};
['syncHomeMultiHolder','syncHomeMultiUi','buildCardActionGrid','makeResultCard','handleBack'].forEach(function(n){load(n,c);});
c.homeMultiBar=new FakeView(); c.exitHomeMulti(); c.syncHomeMultiUi();
assert.strictEqual(c.homeMultiBar.children[0].children[0].text,'多选');
c.homeMultiBar.children[0].children[0].click(); assert(c.homeMulti.active);
c.makeResultCard({id:1},{}); var holder=c.resultCardHolders[0];
holder.card.click(); assert.strictEqual(c.homeMultiIds()[0],1); assert.strictEqual(inputCount,0);
assert.strictEqual(holder.multiCheck.text,'☑ 已选'); holder.card.longClick();assert.strictEqual(tokenCount,0);
holder.row={id:2};holder.itemId=2;c.syncHomeMultiHolder(holder);
assert.strictEqual(holder.multiCheck.text,'☐ 选择');holder.multiCheck.click();assert.deepStrictEqual(Array.from(c.homeMultiIds()),[1,2]);
c.requestHomeMultiDelete(); var confirmButton=c.homeMultiBar.children[1].children[1];
c.handleBack(); assert(c.homeMulti.active); assert.strictEqual(c.homeMulti.confirmation,null);
c.handleBack(); assert.strictEqual(c.homeMulti.active,false);confirmButton.click();assert.strictEqual(calls.length,1);
holder.card.click();holder.card.longClick();assert.strictEqual(inputCount,1);assert.strictEqual(tokenCount,1);
c.beginHomeMulti();
['copyResultRow','editResultRow','deleteResultRow','translateResultRow','openTokenizerForResultRow','swipeInteractionBlocked','performSwipeAction'].forEach(function(n){load(n,c);});
assert.strictEqual(c.copyResultRow({id:1}),false);assert.strictEqual(c.editResultRow({id:1}),false);
assert.strictEqual(c.deleteResultRow({id:1}),false);assert.strictEqual(c.translateResultRow({id:1}),false);
assert.strictEqual(c.openTokenizerForResultRow({id:1}),false);assert.strictEqual(c.swipeInteractionBlocked(),true);
assert.strictEqual(c.performSwipeAction({id:1},1),false);
console.log('PASS real Filter UI: entry, rendered checkbox, recycled holder ID, card tap/long press, action guards, actual handleBack, stale confirmation button');
['cancelInitialStagedFill','cancelKeyedStagedReconcile','cancelOverlapStagedFill','cancelStagedAjaxAttach','stopFilterImeAvoidance','invalidateHydrationWorker','clearSelectedResult','clearDeleteUndo'].forEach(function(n){c[n]=function(){};});
c.getPanelState=function(){return {};};c.renderGeneration=0;c.refreshGeneration=0;c.advancedVisible=false;c.searchExpanded=false;c.panelRemovalPending=false;c.pendingDestroyCache=false;
c.toggleHomeMulti(1);snapshot=c.requestHomeMultiDelete();c.state.panelAttached=false;
load('closePanel',c); assert.strictEqual(c.closePanel({}).alreadyClosed,true);
assert.strictEqual(c.homeMulti.active,false);assert.strictEqual(c.homeMultiIds().length,0);
c.state.panelAttached=true;c.rootMode=true;c.beginHomeMulti();c.toggleHomeMulti(2);
assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false);
load('mountPrimaryChildPage',c);c.getPrimaryHostState=function(){return {ready:false};};
assert.throws(function(){c.mountPrimaryChildPage({});},/unavailable/);assert.strictEqual(c.homeMulti.active,false);
c.beginHomeMulti();c.toggleHomeMulti(1);snapshot=c.requestHomeMultiDelete();
c.ClipHub.List.deleteItems=function(ids){assert.strictEqual(c.confirmHomeMultiDelete(snapshot),false);return {count:1,itemIds:[ids[0]],deletedAt:1};};
assert.strictEqual(c.confirmHomeMultiDelete(snapshot),true);
console.log('PASS real lifecycle: closePanel clears selection and invalidates confirmation, child mount cleanup, reentrant delete guarded');
var savedSync = c.syncHomeMultiUi;
c.syncHomeMultiUi = function () { throw new Error('idle reset must not touch uninitialized UI'); };
assert.strictEqual(c.exitHomeMulti(), true);
c.syncHomeMultiUi = savedSync;
console.log('PASS idle lifecycle reset leaves UI and main handler untouched');
c.pendingDeleteUndo = {itemId: 1, count: 2, expiresAt: 5000};
c.deleteUndoGeneration = 0;
c.removeDeleteUndoView = function () {};
load('clearDeleteUndo', c);
load('performDeleteUndo', c);
c.ClipHub.List.undoLastDelete = function () { return false; };
assert.strictEqual(c.performDeleteUndo(), false);
assert(c.pendingDeleteUndo, 'a failed batch undo must keep its retry button until timeout');
c.ClipHub.List.undoLastDelete = function () { return true; };
assert.strictEqual(c.performDeleteUndo(), true);
assert.strictEqual(c.pendingDeleteUndo, null);
console.log('PASS undo failure preserves the banner and successful retry consumes it');
