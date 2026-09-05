/* Offline interaction tests: execute real Filter functions; Android views are isolated mocks. */
var fs = require('fs'), vm = require('vm'), assert = require('assert'), zlib = require('zlib');
var inputPath = process.argv[2];
var source = fs.readFileSync(inputPath || 'src/ch_11_filter.js', 'utf8');
if (!inputPath) source = zlib.gunzipSync(Buffer.from(vm.runInNewContext(source.match(/var PACKED_B64\s*=([\s\S]*?);/)[1]), 'base64')).toString('utf8');
function load(name, c) {
    var start = source.indexOf('    function ' + name + '(');
    assert(start >= 0, 'Missing real Filter function: ' + name);
    var end = source.indexOf('\n    function ', start + 5);
    vm.runInContext(source.slice(start, end < 0 ? undefined : end), c);
}
function Params(w, h, weight) { this.width=w; this.height=h; this.weight=weight; }
function LinearParams(w,h,weight) { Params.call(this,w,h,weight); this.parentType='linear'; }
function FrameParams(w,h,weight) { Params.call(this,w,h,weight); this.parentType='frame'; }
LinearParams.MATCH_PARENT=FrameParams.MATCH_PARENT=-1;
LinearParams.WRAP_CONTENT=FrameParams.WRAP_CONTENT=-2;
function MockView() { this.children=[]; this.text=''; this.enabled=true; this.visibility=0; }
MockView.prototype.addView=function(v,lp){
    assert(v instanceof MockView, 'a real child view is required');
    assert(!v.parent, 'view must have a single parent');
    if(lp) assert.strictEqual(lp.parentType,this.parentType,'LayoutParams must match actual parent');
    v.parent=this; v.lp=lp; this.children.push(v);
};
MockView.prototype.removeAllViews=function(){this.children.forEach(function(v){v.parent=null;});this.children=[];};
MockView.prototype.getChildAt=function(i){return this.children[i];};
MockView.prototype.getChildCount=function(){return this.children.length;};
MockView.prototype.setOnClickListener=function(l){this.listener=l.onClick;};
MockView.prototype.setOnLongClickListener=function(l){this.longListener=l.onLongClick;};
MockView.prototype.click=function(){if(this.enabled&&this.listener)return this.listener();return false;};
MockView.prototype.longClick=function(){if(this.longClickable&&this.longListener)return this.longListener();return false;};
MockView.prototype.setText=function(v){this.text=String(v);};
MockView.prototype.getText=function(){var s=this.text;return {length:function(){return s.length;},toString:function(){return s;}};};
MockView.prototype.setVisibility=function(v){this.visibility=v;};
MockView.prototype.setEnabled=function(v){this.enabled=v;};
MockView.prototype.setContentDescription=function(v){this.description=v;};
MockView.prototype.setBackground=function(v){this.background=v;};
MockView.prototype.setLongClickable=function(v){this.longClickable=v;};
MockView.prototype.setSelected=function(v){this.selected=v;};
MockView.prototype.setMinimumHeight=function(v){this.minimumHeight=v;};
MockView.prototype.setLayoutParams=function(v){this.lp=v;};
MockView.prototype.getLayoutParams=function(){return this.lp;};
['setOrientation','setGravity','setSingleLine','setEllipsize','setPadding','setSelection','setHint','setTextSize','setInputType','setImeOptions','setOnEditorActionListener','addTextChangedListener','setClickable','setFocusable','setAlpha','setClipChildren','setClipToPadding','setMaxLines','setMaxWidth','setMinimumWidth'].forEach(function(k){MockView.prototype[k]=function(){};});
MockView.prototype.setPadding=function(left,top,right,bottom){this.padding={left:left,top:top,right:right,bottom:bottom};};
function Linear(){MockView.call(this);this.parentType='linear';}
function Frame(){MockView.call(this);this.parentType='frame';}
Linear.prototype=Object.create(MockView.prototype); Frame.prototype=Object.create(MockView.prototype);
Linear.LayoutParams=LinearParams; Frame.LayoutParams=FrameParams;
Linear.VERTICAL=1; Linear.HORIZONTAL=0;
function text(v){var r=new MockView();r.setText(v);return r;}
var colors={textPrimary:'#222222',textSecondary:'#666666',textTertiary:'#888888',icon:'#666666',accentStrong:'#7652C8',accentSoft:'#F9F6FF',accentBorder:'#D8CBF2',surfaceMuted:'#EEEEEE',card:'#FFFFFF',stroke:'#DDDDDD',danger:'#B64F63',dangerSoft:'#FCECF0'};
var c=vm.createContext({
    homeMulti:{active:false,ids:[],confirmation:null,generation:0,busy:false,message:'',more:false},
    HOME_MULTI_LIMIT:100,homeMultiBar:null,homeMultiHeader:null,homeNormalHeader:null,homeMultiEntry:null,
    rootMode:true,state:{panelAttached:true},primaryShellPageId:'',previewRows:[{id:2},{id:1}],resultCardHolders:[],
    LinearLayout:Linear,FrameLayout:Frame,EditText:MockView,TextView:MockView,TextWatcher:{},appContext:{},
    View:{VISIBLE:0,GONE:8},Gravity:{CENTER:17,CENTER_VERTICAL:16,START:3,END:5},
    TextUtils:{TruncateAt:{END:1}},TypedValue:{COMPLEX_UNIT_SP:2},InputType:{},EditorInfo:{IME_ACTION_SEARCH:3},
    JavaAdapter:function(t,a){return a;},dp:function(n){return n;},isMainThread:function(){return true;},palette:function(){return colors;},
    makeText:text,makeSecondaryButton:text,makeIcon:function(icon,size,color,desc){var v=text(icon);v.description=desc;v.color=color;return v;},
    circleBackground:function(fill,stroke){return {shape:'circle',fill:fill,stroke:stroke};},
    roundedBackground:function(fill,stroke,radius){return {shape:'round',fill:fill,stroke:stroke,radius:radius};},
    headerMetrics:function(){return {iconSp:20,titleSp:18,statusSp:12,actionSizeDp:36,controlHeightDp:40,gapDp:4,radiusDp:12,inputPaddingDp:8};},
    value:{keyword:'',sortMode:'latest'},advancedActionViews:[],resultActionViews:[],resultCardViews:[],scrollPerformanceState:{},
    SELECTION_ENABLED:false,selectedItemId:null,
    makeFilterAction:function(){var v=new Frame();v.description='筛选';return v;},sortModeLabel:function(){return '最新';},
    ClipHub:{Theme:{applyTextColor:function(v,color){v.color=color;},applyHintTextColor:function(){}},Clipboard:{},List:{}},
    refreshPrimarySystemBack:function(){},cancelActiveSwipe:function(){},hideKeyboardOnMain:function(){},
    updateResultCountOnMain:function(){},updateQuickResetView:function(){},updateSearchVisibility:function(){},
    refreshPrimaryResults:function(){},attachCopyFeedbackBanner:function(){},showInputToast:function(){},
    rememberDeleteUndo:function(){},attachDeleteUndoBanner:function(){}
});
['homeMultiIds','exitHomeMulti','beginHomeMulti','toggleHomeMulti','selectLoadedHomeMulti','requestHomeMultiDelete','cancelHomeMultiConfirm','confirmHomeMultiDelete','backHomeMulti','syncHomeMultiHolder','syncHomeMultiUi','makeHeaderAction','buildSearchHeader'].forEach(function(n){load(n,c);});
function byDesc(v,desc){if(v.description===desc)return v;for(var i=0;i<v.children.length;i++){var found=byDesc(v.children[i],desc);if(found)return found;}return null;}
function byText(v,s){if(v.text===s)return v;for(var i=0;i<v.children.length;i++){var found=byText(v.children[i],s);if(found)return found;}return null;}
c.ImageView=MockView;MockView.ScaleType={CENTER_INSIDE:1};
MockView.prototype.setScaleType=function(){};MockView.prototype.setImageDrawable=function(d){this.image=d;};
c.makeVectorIconDrawable=function(kind,color,size,stroke){return {kind:kind,color:color,size:size,stroke:stroke};};
var header=c.buildSearchHeader(colors);c.homeMultiBar=new Linear();c.syncHomeMultiUi();
var search=byDesc(header,'展开搜索'), entry=byDesc(header,'进入多选模式');
assert(entry,'search row must contain multi-select entry');
assert.strictEqual(search.parent.children.indexOf(entry),search.parent.children.indexOf(search)+1);
assert(byDesc(header,'新增剪切板内容')); assert(byDesc(header,'打开 ClipHub 设置')); assert(byDesc(header,'关闭全局剪切板'));
assert.strictEqual(c.homeMultiBar.visibility,8,'normal mode has no extra multiselect row');
entry.click();assert(c.homeMulti.active);assert.strictEqual(c.homeNormalHeader.visibility,8);assert.strictEqual(c.homeMultiHeader.visibility,0);
assert(byText(c.homeMultiHeader,'已选择 0 项'));
assert(byDesc(header,'批量删除').image,'delete must use a vector trash icon');
assert.strictEqual(byDesc(header,'批量删除').image.kind,'delete');
assert.strictEqual(byDesc(header,'批量删除').image.color,colors.danger);
assert.strictEqual(byDesc(header,'合并记录').image.kind,'merge');
['批量复制','合并记录','批量删除','更多批量操作','退出多选'].forEach(function(desc){var b=byDesc(header,desc);assert(b,desc);assert.strictEqual(b.background.shape,'circle');assert.strictEqual(b.lp.width,b.lp.height);});
['批量复制','合并记录','批量删除'].forEach(function(desc){assert.strictEqual(byDesc(header,desc).enabled,false,'empty selection disables '+desc);});
c.toggleHomeMulti(1);assert(byText(c.homeMultiHeader,'已选择 1 项'));assert(byDesc(header,'批量复制').enabled);
byDesc(header,'退出多选').click();assert(!c.homeMulti.active);assert.strictEqual(c.homeNormalHeader.visibility,0);assert.strictEqual(c.homeMultiHeader.visibility,8);
console.log('PASS toolbar: search-adjacent entry, normal header preserved, replacement header, circular actions, count, empty guard, exit, parent LayoutParams');
// Measure the fixed-size action suffix of real header rows from their common right edge.
// Android LinearLayout puts the preceding weighted title/input in the remaining space.
function rightActionCenters(row) {
    var inset=row.padding ? row.padding.right : 0, centers=[];
    for(var i=row.children.length-1;i>=0;i--) {
        var child=row.children[i], lp=child.lp;
        if(child.visibility===8) continue;
        if(!lp || lp.weight || lp.width<=0) break;
        inset+=lp.rightMargin||0;
        centers.push(inset+lp.width/2);
        inset+=lp.width+(lp.leftMargin||0);
    }
    return centers;
}
var normalCenters=rightActionCenters(c.homeNormalHeader);
assert.deepStrictEqual(normalCenters,[22,62,102],'normal screenshot baseline: 4dp right gap and 40dp pitch');
assert.deepStrictEqual(rightActionCenters(c.searchStatusRow),normalCenters,'normal status buttons align under title actions');
c.beginHomeMulti();
assert.deepStrictEqual(rightActionCenters(c.homeMultiHeader).slice(0,3),normalCenters,'multiselect rightmost three buttons stay on normal columns');
c.exitHomeMulti();
console.log('PASS alignment: multiselect actions preserve the normal right edge and columns');
c.searchExpanded=false;c.advancedVisible=false;c.historyContainerView=null;
c.stopFilterImeAvoidance=function(){};c.requestKeyboardOnMain=function(){};
['updateSearchVisibility','setSearchExpanded'].forEach(function(n){load(n,c);});
c.setSearchExpanded(true,false);
assert.strictEqual(c.searchStatusRow.visibility,8);
assert.strictEqual(c.searchInputRow.visibility,0);
assert.deepStrictEqual(rightActionCenters(c.searchInputRow),normalCenters.slice(0,2),'search clear/filter stay on normal rightmost columns');
c.beginHomeMulti();
assert.deepStrictEqual(rightActionCenters(c.searchInputRow),normalCenters.slice(0,2),'search plus multiselect preserves search button columns');
c.setSearchExpanded(false,false);c.exitHomeMulti();
console.log('PASS alignment: expanded search preserves the normal right edge with multiselect on/off');
var defaultMetrics=c.headerMetrics, defaultDp=c.dp;
[[32,36,3,1],[40,44,6,1.5],[48,56,8,2.75]].forEach(function(config){
    c.headerMetrics=function(){var m=defaultMetrics();m.actionSizeDp=config[0];m.controlHeightDp=config[1];m.gapDp=config[2];return m;};
    c.dp=function(n){return Math.round(n*config[3]);};
    header=c.buildSearchHeader(colors);c.syncHomeMultiUi();
    var baseline=rightActionCenters(c.homeNormalHeader);
    var rowY=c.homeNormalHeader.lp.height+c.homeNormalHeader.lp.bottomMargin+c.searchStatusRow.lp.height/2;
    [[false,false],[true,false],[true,true],[false,true],[false,false],[false,true],[true,true],[true,false],[false,false]].forEach(function(mode){
        if(mode[0]) c.beginHomeMulti();else c.exitHomeMulti();
        c.setSearchExpanded(mode[1],false);
        var top=mode[0]?c.homeMultiHeader:c.homeNormalHeader;
        var bottom=mode[1]?c.searchInputRow:c.searchStatusRow;
        assert.strictEqual(top.visibility,0);assert.strictEqual(bottom.visibility,0);
        assert.deepStrictEqual(rightActionCenters(top).slice(0,3),baseline,'top columns survive both toggle orders at scaled density');
        assert.deepStrictEqual(rightActionCenters(bottom),baseline.slice(0,mode[1]?2:3),'search/status columns stay anchored across states');
        assert.strictEqual(top.lp.height+top.lp.bottomMargin+bottom.lp.height/2,rowY,'second row vertical center stays unchanged');
    });
});
c.headerMetrics=defaultMetrics;c.dp=defaultDp;header=c.buildSearchHeader(colors);c.syncHomeMultiUi();
console.log('PASS alignment: both toggle orders, scaled metrics/densities and stable row heights');
c.makeSwipeAction=text;c.makeSourceIcon=function(){return new MockView();};
c.makeCardActionButton=function(kind,desc,col,danger,metrics,callback){var v=text(kind);v.description=desc;v.listener=callback;return v;};
c.resultPreviewText=function(row){return String(row.id);};c.tagsForResult=function(){return [];};c.tagSummary=function(){return '';};
c.sourceLabel=function(){return '';};c.formatTime=function(){return '';};c.pxToDp=function(n){return n;};
c.resultCardMetrics=function(){return new Proxy({},{get:function(){return 20;}});};
c.bindSwipeGesture=function(){};c.currentCardHolderRow=function(h){return h.row;};
['buildCardActionGrid','makeResultCard'].forEach(function(n){load(n,c);});
c.makeResultCard({id:1},colors);var holder=c.resultCardHolders[0];
assert.strictEqual(holder.card.children[0],holder.multiCheck,'selection circle belongs at the far left');
assert.strictEqual(holder.card.children[1],holder.iconView,'original source icon follows circle');
assert.strictEqual(holder.multiCheck.visibility,8);var originalHeight=holder.card.minimumHeight;
c.beginHomeMulti();c.toggleHomeMulti(1);
assert.strictEqual(holder.actionGrid.children.length,2);holder.actionGrid.children.forEach(function(v){assert.strictEqual(v.visibility,0);});
assert.strictEqual(holder.multiCheck.text,'✓');assert.strictEqual(holder.multiCheck.background.shape,'circle');
assert.strictEqual(holder.multiCheck.background.fill,colors.accentStrong);assert.strictEqual(holder.multiCheck.color,'#FFFFFFFF');
assert.strictEqual(holder.multiCheck.lp.width,holder.multiCheck.lp.height);assert.strictEqual(holder.card.background.fill,colors.accentSoft);
assert.strictEqual(holder.card.minimumHeight,originalHeight);assert.strictEqual(holder.actionGrid.lp.height,20);
holder.row={id:2};holder.itemId=2;c.syncHomeMultiHolder(holder);assert.strictEqual(holder.multiCheck.text,'');
assert.strictEqual(holder.card.background.fill,colors.card);holder.multiCheck.click();assert.strictEqual(holder.multiCheck.text,'✓');
c.exitHomeMulti();assert.strictEqual(holder.multiCheck.visibility,8);assert.strictEqual(holder.card.background.fill,colors.card);
console.log('PASS cards: left circle before icon, purple/white selection, recycled ID, selected tint, original action grid and height');
['toggleHomeMultiMore','clearHomeMultiSelection'].forEach(function(n){load(n,c);});
c.beginHomeMulti();byDesc(header,'更多批量操作').click();assert(c.homeMulti.more);
assert(byText(c.homeMultiBar,'全选已加载'));assert(byText(c.homeMultiBar,'清空选择'));
c.previewRows=[];for(var i=1;i<=120;i++)c.previewRows.push({id:i});
byText(c.homeMultiBar,'全选已加载').click();assert.strictEqual(c.homeMultiIds().length,100);assert(/100/.test(c.homeMulti.message));
assert.strictEqual(c.toggleHomeMulti(101),false);
byDesc(header,'更多批量操作').click();byText(c.homeMultiBar,'清空选择').click();assert.strictEqual(c.homeMultiIds().length,0);
byDesc(header,'更多批量操作').click();var staleClear=byText(c.homeMultiBar,'清空选择');
c.exitHomeMulti();c.beginHomeMulti();c.toggleHomeMulti(1);staleClear.click();assert.strictEqual(c.homeMultiIds().length,1);
byDesc(header,'更多批量操作').click();assert.strictEqual(c.backHomeMulti(),true);assert(c.homeMulti.active);assert.strictEqual(c.homeMulti.more,false);
c.exitHomeMulti();console.log('PASS more: inline select loaded, 100 cap, clear, Back dismissal, stale menu callback');

['fullResultRowById','readHomeMultiText','copyHomeMulti'].forEach(function(n){load(n,c);});
var rows={1:{id:1,content:'first FULL正文',is_sensitive:1},2:{id:2,content:'second FULL正文',is_sensitive:0}},writes=[],reads=[];
c.ClipHub.Repository={getItem:function(id,deleted){assert.strictEqual(deleted,false);reads.push(id);return rows[id]||null;}};
c.ClipHub.Clipboard.writeText=function(value,options){writes.push({text:value,options:options});return {ok:true};};
c.previewRows=[{id:2,content:'preview only'},{id:1,content:'preview only'}];c.beginHomeMulti();c.toggleHomeMulti(1);c.toggleHomeMulti(2);
byDesc(header,'批量复制').click();assert.strictEqual(writes.length,1);assert.strictEqual(writes[0].text,'second FULL正文\nfirst FULL正文');
assert.strictEqual(writes[0].options.sensitive,true);assert.strictEqual(writes[0].options.label,'ClipHub');assert.deepStrictEqual(reads,[2,1]);
assert(c.homeMulti.active);assert.strictEqual(c.homeMultiIds().length,2);
c.previewRows=[{id:2}];assert.strictEqual(c.copyHomeMulti(),false);assert.strictEqual(writes.length,1);assert(c.homeMulti.message);
c.previewRows=[{id:2},{id:1}];delete rows[1];assert.strictEqual(c.copyHomeMulti(),false);assert.strictEqual(writes.length,1);
rows[1]={id:1,content:'first FULL正文',is_sensitive:0};assert.strictEqual(c.copyHomeMulti(),true);assert.strictEqual(writes[1].options.sensitive,false);
c.ClipHub.Clipboard.writeText=function(){throw new Error('clipboard denied');};assert.strictEqual(c.copyHomeMulti(),false);assert(/clipboard denied/.test(c.homeMulti.message));assert.strictEqual(c.homeMulti.busy,false);
c.ClipHub.Clipboard.writeText=function(){return {ok:false};};assert.strictEqual(c.copyHomeMulti(),false);
var staleCopy=byDesc(header,'批量复制');c.exitHomeMulti();c.beginHomeMulti();c.toggleHomeMulti(2);staleCopy.click();assert.strictEqual(writes.length,2);
c.clearHomeMultiSelection();assert.strictEqual(c.copyHomeMulti(),false);c.exitHomeMulti();
console.log('PASS copy: actual Clipboard API, full content, current list order, sensitive propagation, missing IDs fail closed, failures, stale callback, zero');

['requestHomeMultiMerge','confirmHomeMultiMerge'].forEach(function(n){load(n,c);});
var saves=[];rows[1].is_sensitive=1;
c.ClipHub.Clipboard.recordManualText=function(value,options){saves.push({text:value,options:options});return {ok:true,recorded:true,id:3,inserted:true};};
c.beginHomeMulti();c.toggleHomeMulti(1);c.toggleHomeMulti(2);byDesc(header,'合并记录').click();var mergeSnapshot=c.homeMulti.confirmation;
assert(mergeSnapshot);assert.strictEqual(saves.length,0);assert.strictEqual(c.toggleHomeMulti(1),false);
assert.strictEqual(c.confirmHomeMultiDelete(mergeSnapshot),false,'merge snapshot cannot trigger delete');
assert(byText(c.homeMultiBar,'确认合并'));byText(c.homeMultiBar,'确认合并').click();
assert.strictEqual(saves.length,1);assert.strictEqual(saves[0].text,'second FULL正文\n\nfirst FULL正文');
assert.strictEqual(saves[0].options.sensitive,true);assert.strictEqual(saves[0].options.origin,'home_multi_merge');
assert.strictEqual(saves[0].options.preserveExistingRecords,true);
assert.strictEqual(saves[0].options.sourcePackage,'cliphub');assert(rows[1]&&rows[2],'source records retained');assert.strictEqual(c.homeMulti.active,false);
assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);
c.beginHomeMulti();c.toggleHomeMulti(1);mergeSnapshot=c.requestHomeMultiMerge();var staleMerge=byText(c.homeMultiBar,'确认合并');
c.cancelHomeMultiConfirm();c.requestHomeMultiMerge();staleMerge.click();assert.strictEqual(saves.length,1);
mergeSnapshot=c.homeMulti.confirmation;delete rows[1];assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);assert.strictEqual(saves.length,1);assert(c.homeMulti.message);
rows[1]={id:1,content:'first FULL正文',is_sensitive:1};mergeSnapshot=c.requestHomeMultiMerge();rows[1].content='edited elsewhere';
assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);assert.strictEqual(saves.length,1);
mergeSnapshot=c.requestHomeMultiMerge();c.ClipHub.Clipboard.recordManualText=function(){return {ok:false,reason:'text_too_large'};};
assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);assert(c.homeMulti.active);assert.strictEqual(c.homeMulti.busy,false);assert(/text_too_large/.test(c.homeMulti.message));
mergeSnapshot=c.requestHomeMultiMerge();c.ClipHub.Clipboard.recordManualText=function(){throw new Error('locked');};assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);
mergeSnapshot=c.requestHomeMultiMerge();c.ClipHub.Clipboard.recordManualText=function(){assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);return {ok:true,recorded:true,id:1,merged:true};};
assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),true);assert(/已保存合并内容/.test(c.homeMulti.message));
c.beginHomeMulti();assert.strictEqual(c.requestHomeMultiMerge(),false);c.toggleHomeMulti(2);mergeSnapshot=c.requestHomeMultiMerge();c.state.panelAttached=false;
assert.strictEqual(c.confirmHomeMultiMerge(mergeSnapshot),false);c.state.panelAttached=true;c.exitHomeMulti();
console.log('PASS merge: inline confirmation, blank-line full-text join, sensitive save, originals retained, snapshot kind/identity, existence/content recheck, errors, dedup success, reentrancy, detached/empty guard');
// Exercise real Canvas drawable paths with isolated Android graphics primitives.
function Paint(){} Paint.ANTI_ALIAS_FLAG=1;Paint.Style={STROKE:1};Paint.Cap={ROUND:1};Paint.Join={ROUND:1};
['setStyle','setStrokeCap','setStrokeJoin','setStrokeWidth'].forEach(function(n){Paint.prototype[n]=function(){};});
function Path(){this.ops=[];}Path.prototype.reset=function(){this.ops=[];};
['moveTo','lineTo','close'].forEach(function(n){Path.prototype[n]=function(){this.ops.push([n].concat(Array.from(arguments)));};});
c.Paint=Paint;c.Path=Path;c.Drawable={};c.RectF=function(){};
c.ClipHub.Theme.applyPaintColor=function(paint,col){paint.color=col;};
load('makeVectorIconDrawable',c);
function drawn(kind){var d=c.makeVectorIconDrawable(kind,colors.accentStrong,20,2),out=[];
d.getBounds=function(){return {left:0,top:0,width:function(){return 20;},height:function(){return 20;}};};
d.draw({drawPath:function(p){out.push(['path',p.ops]);},drawLine:function(){out.push(['line']);},drawRoundRect:function(){out.push(['roundRect']);}});return out;}
var mergeDraw=drawn('merge');assert.strictEqual(mergeDraw[0][0],'path');
assert.strictEqual(mergeDraw[0][1].filter(function(op){return op[0]==='moveTo';}).length,3,'two converging branches and arrowhead');
assert(drawn('delete').some(function(op){return op[0]==='roundRect';}),'trash can body is drawn');
console.log('PASS graphics: real vector merge branches and trash body draw through safe Theme paint');
c.state.panelAttached=false;c.panelRemovalPending=true;c.dropPrimaryChildOverlayForDestroy=function(){};
load('destroyPanelCache',c);c.destroyPanelCache('offline test');
assert.strictEqual(c.homeMultiBar,null);assert.strictEqual(c.homeMultiHeader,null);assert.strictEqual(c.homeNormalHeader,null);assert.strictEqual(c.homeMultiEntry,null);
console.log('PASS destroy: all multiselect header references released');
