import ApartmentCard from '../components/ApartmentCard';
import { useState, useEffect } from 'react'


export default function HomePage(){


    // url api
        const base_api_url= import.meta.env.EXPRESS_API_SERVER
        const apartment_api_url= `${base_api_url}apartments`
        const [ apartments, setApartments ] = useState([]);


        useEffect(()=> {

            //make a fetch request to the base api endpoint

        fetch(apartment_api_url)
        .then(res => {
            if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
        })
        .then(data=>{
            console.log(data.apartments);
            setApartments(data.apartments);
            
        }).catch(err => console.log(err))
        }, [])


    return(
       <>
            <section className='d-flex justify-content-around'>
                <div className='container'>
                <div className='row row-cols-3 p-5 g-5'>
              
                 {
                     apartments && apartments.map(apartment =>(<div className='col'key={apartment.id}><ApartmentCard apartment={apartment}/> </div>) )
                 }
              
  
                </div>
                </div>


            </section>
       
       </>


        
    )
}