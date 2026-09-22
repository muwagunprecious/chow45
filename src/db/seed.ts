async function seed() {

    console.log("Done seeding.");

    process.exit(0);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});