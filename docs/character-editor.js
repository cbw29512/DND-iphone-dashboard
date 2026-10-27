/* One shared character model: left is an editable clone of the card, right is live and playable. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
let active=null,previous=null,creating=false,previewed=false,form=null;
let saveCard=null,getCurrent=null,showDraft=null,restore=null,showFight=null,showPreview=null;
let pending=null,portraitData="";
function message(value){$("cardEditMessage").textContent=value;}
function editing(){return Boolean(form);}
function cloneCard(card){
 const target=$("editorCard");target.replaceChildren();
 const play=$("play");
 // Clone actual rendered card components, not a second, independently-authored layout.
 const top=play.querySelector(".titlebar").cloneNode(true);
 top.querySelector(".row")?.remove();
 const hero=play.querySelector(".portrait-hero").cloneNode(true);
 const actionPanel=$("actions").parentElement.cloneNode(true);
 actionPanel.querySelector(".tabs")?.remove();
 const refs={who:top.querySelector("#who"),identity:top.querySelector("#identity"),
  stats:hero.querySelector("#stats"),actions:actionPanel.querySelector("#actions"),
  portrait:hero.querySelector("#portraitImage"),
  initials:hero.querySelector("#portraitInitials")};
 for(const node of [top,hero,actionPanel]){
  node.querySelectorAll("[id]").forEach(element=>element.removeAttribute("id"));
 }
 const label=document.createElement("label");label.className="card-portrait-upload";
 label.textContent="Change picture";
 const upload=document.createElement("input");upload.id="portraitUpload";
 upload.type="file";upload.accept="image/png,image/jpeg,image/webp";label.append(upload);
 hero.append(label);
 upload.addEventListener("change",e=>changePortrait(e.target.files?.[0],refs));
 target.append(top,hero,actionPanel);
 target.classList.add("editing");
 const photo=CharacterFormModel.safePortrait(card.portrait);
 refs.portrait.hidden=!photo;
 if(photo)refs.portrait.src=photo;else refs.portrait.removeAttribute("src");
 refs.initials.textContent=card.name.trim().slice(0,2).toUpperCase()||"PC";
 refs.initials.hidden=!!photo;
 return refs;
}
function livePreview(){
 if(!form)return;
 try{
  const values=form.collect();
  const name=String(values.name||"").trim();
  values.name=name||"New Character";
  values.fresh=creating&&!previewed;
  values.portrait=portraitData||active?.portrait||"";
  const candidate=CharacterFormModel.apply(getCurrent?.()||active,values);
  // Do not overwrite saved play resources or the roll history while editing.
  previewed=true;showPreview(candidate);message("Preview updates live. Save & Play keeps your changes.");
 }catch(error){message(error.message);}
}
function schedule(){
 if(pending!==null)clearTimeout(pending);
 pending=setTimeout(()=>{pending=null;livePreview();},90);
}
function open(card,isNew=false){
 if(!card)return;
 if(editing())cancel();
 previous=getCurrent?.()||null;active=card;creating=isNew;previewed=false;portraitData="";
 if(isNew)showDraft(card);else showFight();
 $("importPanel").open=false;
 const refs=cloneCard(card);
 form=CharacterFormFields.build(card,refs);
 $("editPane").hidden=false;
 $("saveCharacterBtn").hidden=false;$("cancelCharacterBtn").hidden=false;
 $("cardWorkspace").classList.add("split-edit");
 const pane=$("editorCard");
 pane.addEventListener("input",schedule,{signal:listener.signal});
 pane.addEventListener("change",schedule,{signal:listener.signal});
 pane.addEventListener("click",click=>{if(click.target.closest(".card-add,.card-remove"))schedule();},{signal:listener.signal});
 message("Edit the left card. Watch the playable card change on the right.");
 $("cardWorkspace").scrollIntoView({block:"start",behavior:"instant"});
}
let listener=new AbortController();
function close(){
 if(pending!==null)clearTimeout(pending);pending=null;
 listener.abort();listener=new AbortController();
 form=null;active=null;creating=false;previewed=false;portraitData="";
 $("editPane").hidden=true;$("editorCard").replaceChildren();
 $("cardWorkspace").classList.remove("split-edit");
 $("saveCharacterBtn").hidden=true;$("cancelCharacterBtn").hidden=true;
}
function cancel(){
 const old=previous;close();previous=null;restore(old);
}
function save(){
 if(!form||!active)return;
 try{
  const values=form.collect();values.fresh=creating&&!previewed;
  values.portrait=portraitData||active.portrait||"";
  const updated=CharacterFormModel.apply(getCurrent?.()||active,values);
  if(updated.weapons.some(w=>w.formula&&!/^\d+d\d+(?:[+-]\d+)?$/i.test(w.formula)))
   throw Error("Weapon damage dice must look like 1d8+3.");
  for(const sp of updated.spells){
   if(sp.custom?.dice&&!/^([1-9]|[12]\d|30)d(4|6|8|10|12|20)$/i.test(sp.custom.dice))
    throw Error("Spell damage dice must look like 8d6.");
  }
  close();previous=null;saveCard(updated);
 }catch(error){message(error.message);}
}
function changePortrait(file,refs){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>7000000){
  message("Choose a PNG, JPEG or WebP picture under 7 MB.");return;
 }
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{
  try{
   if(!form)return;
   const canvas=document.createElement("canvas");
   const scale=Math.min(1,350/img.naturalWidth,420/img.naturalHeight);
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL("image/jpeg",.74);
   if(!CharacterFormModel.safePortrait(data))throw Error("The portrait is too large.");
   portraitData=data;refs.portrait.src=data;refs.portrait.hidden=false;
   refs.initials.hidden=true;schedule();
  }catch(error){message(error.message);}
  finally{URL.revokeObjectURL(url);}
 };
 img.onerror=()=>{URL.revokeObjectURL(url);message("Picture could not be opened.");};
 img.src=url;
}
function initialize(onSave,current,displayDraft,restoreCard,renderFight,preview){
 saveCard=onSave;getCurrent=current;showDraft=displayDraft;
 restore=restoreCard;showFight=renderFight;showPreview=preview;
 $("createBtn").addEventListener("click",()=>open(CharacterFormModel.blank(),true));
 $("editCharacterBtn").addEventListener("click",()=>open(getCurrent?.(),false));
 $("saveCharacterBtn").addEventListener("click",save);
 $("cancelCharacterBtn").addEventListener("click",cancel);
}
root.CharacterEditor=Object.freeze({initialize,open,cancel,isEditing:editing});
})(typeof globalThis!=="undefined"?globalThis:this);
