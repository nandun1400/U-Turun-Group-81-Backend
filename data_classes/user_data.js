class UserData {
  constructor(name, age, username, email, mobile, password) {
    this.name = name;
    this.age = age;
    this.username = username;
    this.email = email;
    this.mobile = mobile;
    this.password = password;
  }

  printData() {
    console.log(`Name: ${this.name}`);
    console.log(`Age: ${this.age}`);
    console.log(`Username: ${this.username}`);
    console.log(`Email: ${this.email}`);
    console.log(`Mobile: ${this.mobile}`);
    console.log(`Password: ${this.password}`);
  }
}

module.exports = UserData;
