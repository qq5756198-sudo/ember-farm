export function handleFrontierAction(action,button,ctx){
 const {engine,ui,showMenu,closeMenu,renderMenu,save,toast}=ctx,id=button.dataset.id;
 const refresh=()=>{if(ctx.menu)renderMenu();save();};
 if(action==='frontierTab'){showMenu('frontier',{tab:id});return true;}
 if(!action.startsWith('f'))return false;
 let result;
 switch(action){
 case 'fPlot':ui.plotId=Number(id);break;
 case 'fSoilView':engine.f.soilView=!engine.f.soilView;break;
 case 'fPolicy':result=engine.setPolicy(button.dataset.kind,id);break;
 case 'fDigCanal':result=engine.digCanal(Number(id));break;
 case 'fWaterControl':result=engine.waterControl(id);break;
 case 'fEcology':result=engine.ecologyChange(Number(id),ui.ecoTool||'clean');break;
 case 'fRotateKit':ui.kitRotation=((ui.kitRotation||0)+1)%4;break;
 case 'fPlaceKit':result=engine.placeKit(ui.kitId||'club',Number(id)%4,Math.floor(Number(id)/4),ui.kitRotation||0);break;
 case 'fClearKit':result=engine.removeKit(id);break;
 case 'fDropCargo':result=engine.dropCargo(id);break;
 case 'fChallenge':result=engine.selectChallenge(id);break;
 case 'fStartRoute':result=engine.startRoute(id);if(result){closeMenu();save();return true;}break;
 case 'fNextRoute':result=engine.nextRoute(id);if(result&&id!=='rest'){closeMenu();save();return true;}break;
 case 'fFinishRoute':result=engine.finishRoute();if(result){closeMenu();save();return true;}break;
 case 'fRetreatRoute':result=engine.finishRoute(true);if(result){closeMenu();save();return true;}break;
 case 'fCrouch':engine.toggleCrouch();break;
 case 'fStone':closeMenu();result=engine.throwStone({x:engine.s.player.x+Math.cos(engine.s.player.facing)*160,y:engine.s.player.y+Math.sin(engine.s.player.facing)*160});if(!result)toast('在废墟中投石，需要1石头和无遮挡的落点。');save();return true;
 case 'fCraftModule':result=engine.craftModule(id);break;
 case 'fAim':engine.f.aimPart=id;break;
 case 'fCircuit':result=engine.rotateCircuit(Number(id));break;
 case 'fPressure':result=engine.pressureSwitch();break;
 case 'fPower':result=engine.powerCircuit(id);break;
 case 'fMoveClue':result=engine.moveClue(id);break;
 case 'fDecode':result=engine.decodeVault(ctx.root.querySelector('#f-vault-code')?.value.trim());break;
 case 'fIdentify':result=engine.identifyHerb(Number(id),ctx.root.querySelector('#f-herb-name')?.value);break;
 case 'fTrackDog':result=engine.trackDog();if(result){closeMenu();save();return true;}break;
 case 'fPetDog':result=engine.petDog();break;
 case 'fCraftCamera':result=engine.craftCamera();break;
 case 'fCamera':result=engine.toggleCamera();if(result){closeMenu();save();return true;}break;
 case 'fPhoto':closeMenu();ctx.capturePhoto();save();return true;
 case 'fDisplayPhoto':result=engine.displayPhoto(Number(id));break;
 case 'fStartCooking':result=engine.startCooking();break;
 case 'fCookingAction':result=engine.cookingAction(id);break;
 case 'fEnterExhibit':result=engine.enterExhibition(ctx.root.querySelector('#f-exhibit-item')?.value);break;
 case 'fRemoveExhibit':result=engine.removeExhibit(Number(id));break;
 case 'fJudgeExhibit':result=engine.judgeExhibition();break;
 default:return false;
 }
 if(result===false)toast('当前条件不满足，请检查位置、物资或玩法说明。');refresh();return true;
}
