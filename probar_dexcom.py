from getpass import getpass
from pydexcom import Dexcom

username = input("Correo de tu cuenta Dexcom G7: ").strip()
password = getpass("Contraseña de Dexcom: ")

try:
    dexcom = Dexcom(
        username=username,
        password=password,
        region="ous"
    )

    lectura = dexcom.get_current_glucose_reading()

    if lectura is None:
        lectura = dexcom.get_latest_glucose_reading()
        if lectura is None:
            print("No hay lecturas disponibles.")
        else:
            print("Última lectura disponible:", lectura.value, "mg/dL")
            print("Hora:", lectura.datetime)
            print("Aviso: comprueba la antigüedad de la lectura.")
    else:
        print("Glucosa:", lectura.value, "mg/dL", lectura.trend_arrow)
        print("Hora:", lectura.datetime)

except Exception as error:
    print("Error de conexión:", type(error).__name__)
    print("Detalle:", error)
