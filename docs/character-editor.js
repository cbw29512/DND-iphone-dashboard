/* Controller: creation/import and editing share one normalized character schema. */
(function(root){
"use strict";
let active=null,creating=false,form=null,saveCallback=null;
const $=id=>document.getElementById(id);
function open(card,isNew=false){
 active=card;creating=isNew;
 form=CharacterFormFields.build($("editorFields"),card);
 $("editorMessage").textContent=isNew?
  "Fill out the character, then choose Save & Play.":"Changes take effect only when you save.";
 $("editorHeading").textContent=isNew?"Create a character":"Edit "+card.name;
 $("editor").hidden=false;$("play").classList.add("hidden");
 $("importPanel").open=false;
 const portrait=$("portraitPreview");
 const photo=CharacterFormModel.safePortrait(card.portrait);
 portrait.src=photo||"";portrait.hidden=!photo;
 $("portraitUpload").value="";
 $("editor").scrollIntoView({block:"start",behavior:"instant"});
}
function cancel(){
 $("editor").hidden=true;active=null;form=null;
 if(window.character){
  $("play").classList.remove("hidden");
 }else $("importPanel").open=true;
}
function save(){
 if(!active||!form)return;
 try{
  const values=form.collect();
  values.portrait=$("portraitPreview").dataset.ready||active.portrait||"";
  values.fresh=creating;
  const updated=CharacterFormModel.apply(active,values);
  if(updated.weapons.some(w=>w.formula&&!/^\d+d\d+(?:[+-]\d+)?$/i.test(w.formula))){
   throw Error("Weapon dice must look like 1d8+3.");
  }
  const previous=active;
  active=null;form=null;creating=false;
  $("portraitPreview").dataset.ready="";
  $("editor").hidden=true;
  saveCallback(updated,previous);
 }catch(error){
  console.error("Character form validation failed",error);
  $("editorMessage").textContent=error.message;
 }
}
function updatePortrait(file){
 if(!file)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>7_000_000){
  $("editorMessage").textContent="Choose a PNG, JPEG, or WebP picture under 7 MB.";return;
 }
 const img=new Image(),url=URL.createObjectURL(file);
 img.onload=()=>{
  try{
   const canvas=document.createElement("canvas");
   const factor=Math.min(1,350/img.naturalWidth,420/img.naturalHeight);
   canvas.width=Math.max(1,Math.round(img.naturalWidth*factor));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*factor));
   canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
   const encoded=canvas.toDataURL("image/jpeg",0.74);
   if(encoded.length>450000)throw Error("Portrait is too large after resizing.");
   $("portraitPreview").src=encoded;
   $("portraitPreview").dataset.ready=encoded;
   $("portraitPreview").hidden=false;
   $("editorMessage").textContent="Portrait selected. Save & Play to apply it.";
  }catch(error){
   console.warn("Could not prepare portrait",error);
   $("editorMessage").textContent="Unable to process the picture. Try a smaller image.";
  }finally{URL.revokeObjectURL(url);}
 };
 img.onerror=()=>{URL.revokeObjectURL(url);$("editorMessage").textContent="Picture could not be read.";};
 img.src=url;
}
function initialize(onSave){
 saveCallback=onSave;
 $("createBtn").addEventListener("click",()=>open(CharacterFormModel.blank(),true));
 $("editCharacterBtn").addEventListener("click",()=>open(window.character,false));
 $("saveCharacterBtn").addEventListener("click",save);
 $("cancelCharacterBtn").addEventListener("click",cancel);
 $("portraitUpload").addEventListener("change",e=>updatePortrait(e.target.files?.[0]));
}
root.CharacterEditor=Object.freeze({initialize,open,cancel});
})(typeof globalThis!=="undefined"?globalThis:this);
