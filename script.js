const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwol802NzgXkLtWVJiDLX_MnOXlyyWxL0AnVVef1GO8L7TVYAI5uH_6jkJomakcWlih/exec";
const state = { catalogo: [], barrios: {}, cart: [] };
const fmtCOP = v => Number(v || 0).toLocaleString('es-CO');

// === INICIALIZAR ===
async function init(){
  const res = await fetch(SCRIPT_URL);
  const data = await res.json();
  state.catalogo = data.catalogo || [];
  state.barrios = data.barrios || {};
  renderCatalog();
  fillBarrios();
}

// === RENDERIZAR CATÁLOGO ===
function renderCatalog(){
  const cont = document.getElementById("catalogo");
  cont.innerHTML = "";
  state.catalogo.forEach(prod=>{
    if(!prod.img) return;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${prod.img}" alt="${prod.name}">
      <div class="body">
        <div class="name">${prod.name}</div>
        <div class="price">$${fmtCOP(prod.price)}</div>
        <button class="btn-add">Agregar al carrito</button>
      </div>`;
    card.querySelector(".btn-add").addEventListener("click",()=>addToCart(prod));
    cont.appendChild(card);
  });
}

function fillBarrios(){
  const sel=document.getElementById("barrio");
  sel.innerHTML='<option value="">Selecciona…</option>';
  Object.keys(state.barrios).forEach(b=>{
    const opt=document.createElement("option");
    opt.value=b;opt.textContent=b;sel.appendChild(opt);
  });
}

// === CARRITO ===
function addToCart(prod){
  const existing = state.cart.find(p=>p.name===prod.name);
  if(existing){ existing.qty+=1; } 
  else { state.cart.push({...prod, qty:1}); }
  Swal.fire({title:'Producto agregado',text:`${prod.name} se añadió al carrito`,icon:'success',timer:1200,showConfirmButton:false});
}

function removeFromCart(name){
  state.cart = state.cart.filter(p=>p.name!==name);
  renderDrawerCart();
}

// === DRAWER ===
const drawer = document.getElementById("drawerCarrito");
document.getElementById("btnDrawer").onclick = ()=>{ renderDrawerCart(); drawer.classList.add("open"); };
document.getElementById("cerrarDrawer").onclick = ()=>drawer.classList.remove("open");

function renderDrawerCart(){
  const cont = document.getElementById("cartItemsDrawer");
  cont.innerHTML = "";
  let subtotal = 0;
  if(state.cart.length === 0){
    cont.innerHTML = `<p style="text-align:center;color:#666;">Tu carrito está vacío 🛒</p>`;
  } else {
    state.cart.forEach(p=>{
      const sub = p.price * p.qty;
      subtotal += sub;
      cont.innerHTML += `
        <div class="cart-item">
          <span>${p.name}</span>
          <span>x${p.qty}</span>
          <span>$${fmtCOP(sub)}</span>
          <button onclick="removeFromCart('${p.name}')">🗑️</button>
        </div>`;
    });
  }
  const domicilio = 10000;
  const total = subtotal + domicilio;
  document.getElementById("subtotalDrawer").textContent = fmtCOP(subtotal);
  document.getElementById("domicilioDrawer").textContent = fmtCOP(domicilio);
  document.getElementById("totalDrawer").textContent = fmtCOP(total);
}

// === NAVEGACIÓN ===
function show(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

document.getElementById("btnPedidoDrawer").onclick = ()=>{
  drawer.classList.remove("open");
  const resumen = state.cart.map(p=>`${p.qty}x ${p.name}`).join(" | ");
  const subtotal = state.cart.reduce((a,b)=>a+b.price*b.qty,0);
  document.getElementById("resumenProducto").textContent =
    `🛍 ${resumen} — Subtotal: $${fmtCOP(subtotal)} + Domicilio: $10.000`;
  show("viewForm");
};

document.getElementById("btnVolver").addEventListener("click",()=>show("viewCatalog"));

// === FORMULARIO ===
document.getElementById("firmaMensaje").addEventListener("change", e=>{
  const campo=document.getElementById("campoFirmaWrapper");
  if(e.target.value==="Firmado"){
    campo.style.display="block";
    document.getElementById("nombreFirma").required=true;
  } else {
    campo.style.display="none";
    document.getElementById("nombreFirma").required=false;
    document.getElementById("nombreFirma").value="";
  }
});

document.getElementById("pedidoForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const formData=new FormData(e.target);
  await fetch(SCRIPT_URL,{method:"POST",body:formData});
  Swal.fire({title:"Pedido enviado",text:"Tu pedido fue registrado correctamente 🌸",icon:"success"});
  state.cart=[];
  show("viewCatalog");
});

// === CARGA INICIAL ===
init();
