document.addEventListener("DOMContentLoaded", function(){
  // Selecciona la barra de navegación con la clase .navbar-custom
  const navbar = document.querySelector('.navbar-custom');
  if (navbar) {
    // Establece el fondo inicial: celeste pastel translúcido
    navbar.style.backgroundColor = "rgba(30, 123, 163, 0.8)"; // lightblue con 80% opacidad
    navbar.style.transition = "background-color 0.3s";
    
    // Al pasar el cursor (mouseover), cambia el fondo a celeste pastel sólido
    navbar.addEventListener("mouseover", function(){
      navbar.style.backgroundColor = "rgb(37, 116, 208)"; // 100% opaco
    });
    
    // Cuando el cursor sale (mouseout), vuelve al fondo translúcido
    navbar.addEventListener("mouseout", function(){
      navbar.style.backgroundColor = "rgba(30, 123, 163, 0.8)";
    });
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const navbar = document.querySelector('.navbar-custom');
  // Actualiza la variable CSS de Bootstrap que controla el padding vertical
  navbar.style.setProperty('--bs-navbar-padding-y', '1.5rem');
  // Si quieres asegurarte de que se aplique, también puedes forzar los padding superior e inferior:
  navbar.style.paddingTop = '1rem';
  navbar.style.paddingBottom = '1.5rem';
});

document.addEventListener('DOMContentLoaded', function() {
  // Ajustar el padding de la navbar (ya lo tenías funcionando)
  const navbar = document.querySelector('.navbar-custom');
  navbar.style.setProperty('--bs-navbar-padding-y', '2rem');
  navbar.style.paddingTop = '1rem';
  navbar.style.paddingBottom = '1.5rem';

  // Estilos para "SALOME" (la marca)
  const navbarBrand = document.querySelector('.navbar-brand');
  navbarBrand.style.fontSize = '2.5rem';
  navbarBrand.style.fontWeight = 'bold';
  navbarBrand.style.fontFamily = "'Poppins', sans-serif";
  navbarBrand.style.textTransform = 'uppercase';
  navbarBrand.style.letterSpacing = '2px';
  navbarBrand.style.color = '#fff';
  navbarBrand.style.textShadow = '2px 2px 5px rgba(0, 0, 0, 0.3)';
  navbarBrand.style.transition = 'transform 0.3s ease, color 0.3s ease';

  // Efecto hover para "SALOME" (usa color celeste)
  navbarBrand.addEventListener('mouseover', function() {
    navbarBrand.style.transform = 'scale(1.1)';
    navbarBrand.style.color = '#00bfff'; // Celeste
  });
  navbarBrand.addEventListener('mouseout', function() {
    navbarBrand.style.transform = 'scale(1)';
    navbarBrand.style.color = '#fff';
  });

  // Estilos para los demás enlaces de la navbar
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.style.fontSize = '1.1rem';
    link.style.fontWeight = 'bold';
    link.style.transition = 'transform 0.3s ease, color 0.3s ease';

    // Pequeño efecto hover para agrandar un poco
    link.addEventListener('mouseover', function() {
      link.style.transform = 'scale(1.05)';
    });
    link.addEventListener('mouseout', function() {
      link.style.transform = 'scale(1)';
    });
  });
});
