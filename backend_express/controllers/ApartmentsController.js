// import connection
const Joi = require('joi');
const connection = require('../database/connection');

const multer = require('multer');
const path = require('path');

// Configurazione di Multer per l'upload delle immagini
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // la cartella dove salvare i file
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Aggiungi un timestamp al nome del file
    }
});

const upload = multer({ storage: storage }).single('image'); // Configura multer per ricevere un solo file con il nome 'image'


// index
function index(req, res) {

    // db query 
    const sql = `SELECT * FROM apartments ORDER BY vote DESC`;

    // execute the sql query
    connection.query(sql, (err, results) => {
        // error
        if (err) return res.status(500).json({ err: err })

        // response object
        res.status(200).json({
            count: results.length,
            data: results
        })
    })
}

// show
function show(req, res) {

    // get apartment id from request params
    const id = req.params.id

    // db query for single apartment
    const apartment_sql = `SELECT * FROM apartments WHERE id = ? `

    // db query for owner
    const owner_sql = `
    select owners.id, owners.name, owners.last_name, owners.email, owners.phone_number
    from owners
    join apartments
    on apartments.owner_id = owners.id
    where apartments.id = ? `

    // db query for services
    const services_sql = `
    select services.label
    from services
    join services_apartments
    on services.id = services_apartments.service_id
    where services_apartments.apartment_id = ? `

    // db query for reviews
    const reviews_sql = `
    select *
    from reviews
    where apartment_id = ? `

    // execute the apartment_sql query
    connection.query(apartment_sql, Number([id]), (err, results) => {

        // handle errors
        if (err) return res.status(500).json({ err: err })
        if (!results[0]) return res.status(404).json({ err: '404! Apartment not found' })

        // save result
        const apartment = results[0]

        // execute query for owner
        connection.query(owner_sql, Number([id]), (err, owner_results) => {

            // handle errors
            if (err) return res.status(500).json({ err: err })

            // save results as a property of apartment
            apartment.owner = owner_results[0]

            // execute query for services
            connection.query(services_sql, Number([id]), (err, services_results) => {

                // handle errors
                if (err) return res.status(500).json({ err: err })

                // save results as a property of apartment
                const services_labels = services_results.map(service => service.label)
                apartment.services = services_labels

                // execute query for reviews
                connection.query(reviews_sql, Number([id]), (err, reviews_results) => {
                    // handle errors
                    if (err) return res.status(500).json({ err: err })

                    // save results as a property of apartment
                    apartment.reviews = reviews_results

                    // create the response
                    const responseData = {
                        data: apartment
                    }

                    console.log(responseData);

                    // return the response
                    res.status(200).json(responseData)
                })
            })
        })
    })
}


// review
function review(req, res) {

    // validate data input
    const schema = Joi.object({
        username: Joi.string().min(3).required(),
        email: Joi.string().email().required(),
        review: Joi.string().min(3).required(),
        days: Joi.number().min(1).required()
    })

    const { error } = schema.validate(req.body)

    if (error) {
        return res.status(400).json({ error: error.details[0].message })
    }

    // take apartment id from request parameters
    const apartment_id = Number(req.params.id)

    // take values from request body
    const { username, email, review, days } = req.body

    // sql query
    const review_sql = `INSERT INTO reviews SET apartment_id = ?, username = ?, email = ?, review = ?, date = CURRENT_DATE, days = ?`

    // execute query
    connection.query(review_sql, [apartment_id, username, email, review, days], (err, result) => {
        if (err) return res.status(500).json({ error: err })
        return res.status(201).json({ success: true })
    })
}


// create apartment
function create(req, res) {
    // Verification token
    const { id: userId } = req.user;

    // Validazione del corpo della richiesta (formato dei dati, senza l'immagine)
    const schema = Joi.object({
        title: Joi.string().min(3).required(),
        rooms: Joi.number().integer().min(1).required(),
        beds: Joi.number().integer().min(1).required(),
        bathrooms: Joi.number().integer().min(1).required(),
        square_meters: Joi.number().min(1).required(),
        address: Joi.string().required(),
        city: Joi.string().min(2).required(),
        services: Joi.array().items(Joi.number().integer()).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    // Gestione dell'immagine tramite multer
    upload(req, res, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Errore nel caricamento del file immagine.' });
        }

        // Prendere i dati dal body e dal file caricato
        const { title, rooms, beds, bathrooms, square_meters, address, city, services = [] } = req.body;
        const image = req.file ? req.file.path : null; // Percorso dell'immagine

        // Verifica che l'immagine sia stata caricata
        if (!image) {
            return res.status(400).json({ error: 'L\'immagine è obbligatoria.' });
        }

        // Query SQL per inserire un nuovo appartamento
        const new_apartment_sql = `INSERT INTO apartments SET owner_id = ?, title = ?, rooms = ?, beds = ?, bathrooms = ?, square_meters = ?, address = ?, city = ?, image = ?`;

        connection.query(new_apartment_sql, [userId, title, rooms, beds, bathrooms, square_meters, address, city, image], (err, result) => {
            if (err) return res.status(500).json({ error: err });

            const apartmentId = result.insertId;

            // Se non ci sono servizi, ritorna una risposta di successo
            if (services.length === 0) {
                return res.status(201).json({
                    success: true,
                    new_apartment_id: apartmentId
                });
            }

            // Inserimento dei servizi associati all'appartamento
            const service_apartment_values = services.map(serviceId => [apartmentId, serviceId]);

            const service_apartment_sql = `
                INSERT INTO services_apartments (apartment_id, service_id) VALUES ?
            `;

            connection.query(service_apartment_sql, [service_apartment_values], (err) => {
                if (err) return res.status(500).json({ error: err });

                res.status(201).json({
                    success: true,
                    new_apartment_id: apartmentId
                });
            });
        });
    });
}


// vote
function vote(req, res) {

    // get id from request_params
    const id = Number(req.params.id)

    // vote +1 query
    const vote_sql = `UPDATE apartments SET vote = vote + 1 WHERE id = ?`

    // execute query
    connection.query(vote_sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err })
        index(req, res)
    })
}


module.exports = {
    index,
    show,
    review,
    create,
    vote
}