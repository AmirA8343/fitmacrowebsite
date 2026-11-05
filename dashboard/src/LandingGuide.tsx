import { getLanguage } from './i18n';

// Keep this practical guidance in the initial HTML of every language page.
export const landingGuides = {
  en: {
    title: 'How to get a useful calorie and macro estimate',
    sections: [
      ['Describe portions and preparation', 'Instead of “chicken and rice”, try “150 g grilled chicken breast, 1 cup cooked rice, salad, and 1 tablespoon olive oil”. Include sauces, drinks, and cooking fats. Specify whether weights are raw or cooked; a cup of dry rice is different from a cup of cooked rice.'],
      ['Review calories, protein, carbohydrates, and fat', 'FitMacro estimates the nutrition of your meal so you can review it before logging. Check the ingredients and portions, correct anything missing, and compare packaged foods with their nutrition labels. AI cannot know the exact recipe or serving size from a description or photo alone.'],
      ['Keep a daily food diary in your browser', 'Save reviewed meals to your daily log and reuse favorites for foods you eat often. Manual entries and saved favorites do not use your three daily free AI analyses. Web meal history is stored in this browser, so export a backup before clearing browser data or changing devices.'],
    ],
    action: 'Try this meal description',
    example: '150 g grilled chicken breast, 1 cup cooked rice, salad, and 1 tablespoon olive oil',
  },
  es: {
    title: 'Cómo obtener una estimación útil de calorías y macros',
    sections: [
      ['Describe las porciones y la preparación', 'En lugar de “pollo con arroz”, prueba “150 g de pechuga de pollo a la plancha, 1 taza de arroz cocido, ensalada y 1 cucharada de aceite de oliva”. Incluye salsas, bebidas y grasas de cocción. Indica si el peso es en crudo o cocido: una taza de arroz seco no equivale a una taza de arroz cocido.'],
      ['Revisa calorías, proteínas, carbohidratos y grasas', 'FitMacro estima los nutrientes de tu comida para que puedas revisarlos antes de guardarla. Comprueba los ingredientes y las porciones, corrige lo que falte y compara los alimentos envasados con su etiqueta nutricional. La IA no puede conocer la receta ni la porción exactas solo con una descripción o una foto.'],
      ['Lleva un diario de comidas en tu navegador', 'Guarda las comidas revisadas en tu registro diario y reutiliza tus favoritos. Los registros manuales y los favoritos guardados no consumen tus tres análisis gratuitos diarios con IA. El historial web se guarda en este navegador: exporta una copia antes de borrar los datos o cambiar de dispositivo.'],
    ],
    action: 'Prueba esta descripción de comida',
    example: '150 g de pechuga de pollo a la plancha, 1 taza de arroz cocido, ensalada y 1 cucharada de aceite de oliva',
  },
  fr: {
    title: 'Comment obtenir une estimation utile des calories et des macros',
    sections: [
      ['Décrivez les portions et la préparation', 'Au lieu de « poulet et riz », essayez « 150 g de blanc de poulet grillé, 1 tasse de riz cuit, une salade et 1 cuillère à soupe d’huile d’olive ». Incluez les sauces, les boissons et les matières grasses de cuisson. Précisez si le poids est cru ou cuit : une tasse de riz sec est différente d’une tasse de riz cuit.'],
      ['Vérifiez calories, protéines, glucides et lipides', 'FitMacro estime les nutriments de votre repas pour vous permettre de les vérifier avant de l’enregistrer. Contrôlez les ingrédients et les portions, corrigez les oublis et comparez les aliments emballés à leur étiquette nutritionnelle. L’IA ne peut pas connaître la recette ou la portion exactes à partir d’une description ou d’une photo seule.'],
      ['Tenez un journal alimentaire dans votre navigateur', 'Enregistrez les repas vérifiés dans votre journal quotidien et réutilisez vos favoris. Les saisies manuelles et les favoris enregistrés ne consomment pas vos trois analyses IA gratuites par jour. L’historique web reste dans ce navigateur : exportez une sauvegarde avant d’effacer les données ou de changer d’appareil.'],
    ],
    action: 'Essayez cette description de repas',
    example: '150 g de blanc de poulet grillé, 1 tasse de riz cuit, une salade et 1 cuillère à soupe d’huile d’olive',
  },
  de: {
    title: 'So erhältst du eine hilfreiche Schätzung für Kalorien und Makros',
    sections: [
      ['Beschreibe Portionen und Zubereitung', 'Statt „Hähnchen mit Reis“ versuche „150 g gegrillte Hähnchenbrust, 1 Tasse gekochter Reis, Salat und 1 Esslöffel Olivenöl“. Nenne auch Soßen, Getränke und Bratfett. Gib an, ob sich das Gewicht auf rohe oder gegarte Lebensmittel bezieht: Eine Tasse trockener Reis ist etwas anderes als eine Tasse gekochter Reis.'],
      ['Prüfe Kalorien, Eiweiß, Kohlenhydrate und Fett', 'FitMacro schätzt die Nährwerte deiner Mahlzeit, damit du sie vor dem Speichern prüfen kannst. Kontrolliere Zutaten und Portionen, ergänze Fehlendes und vergleiche verpackte Lebensmittel mit ihrer Nährwerttabelle. Die KI kann das genaue Rezept oder die Portionsgröße nicht allein aus einer Beschreibung oder einem Foto erkennen.'],
      ['Führe ein Ernährungstagebuch im Browser', 'Speichere geprüfte Mahlzeiten in deinem Tagesprotokoll und verwende Favoriten für häufig gegessene Gerichte. Manuelle Einträge und gespeicherte Favoriten verbrauchen keine deiner drei kostenlosen KI-Analysen pro Tag. Der Webverlauf bleibt in diesem Browser: Exportiere eine Sicherung, bevor du Browserdaten löschst oder das Gerät wechselst.'],
    ],
    action: 'Probiere diese Mahlzeitbeschreibung aus',
    example: '150 g gegrillte Hähnchenbrust, 1 Tasse gekochter Reis, Salat und 1 Esslöffel Olivenöl',
  },
};

export default function LandingGuide({ useExample }: { useExample: (description: string) => void }) {
  const guide = landingGuides[getLanguage()];
  return <section className="public-guide" aria-labelledby="meal-guide-title">
    <h2 id="meal-guide-title">{guide.title}</h2>
    {guide.sections.map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
    <a href="#public-description" onClick={() => useExample(guide.example)}>{guide.action} →</a>
  </section>;
}
