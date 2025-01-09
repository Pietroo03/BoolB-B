//import express
const express = require('express');

//create router
const router = express.Router();

//import controller
const BnbController = require('../controllers/BnbController');

//index route

router.get('/', BnbController.index)

module.exports = router;
